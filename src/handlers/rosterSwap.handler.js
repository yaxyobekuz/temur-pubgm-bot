import {
  fetchRosterForSwap,
  swapRosterMember,
} from "../services/backend.service.js";
import {
  buildSwapOutKeyboard,
  buildSwapInKeyboard,
  buildSponsorChannelsKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import logger from "../config/logger.js";

// "Hozirgi tarkib" matni + almashtiriladigan o'yinchini tanlash chaqiruvi.
const swapIntroText = (state) => {
  const lines = [
    `🔄 <b>${state.tournamentTitle}</b> - o'yinchi almashtirish`,
    "",
    "Hozirgi tarkib:",
  ];
  for (const r of state.roster) {
    lines.push(`${r.slot === "reserve" ? "◌ (zaxira)" : "★ (asosiy)"} ${r.name}`);
  }
  lines.push("", "Almashtiriladigan o'yinchini tanlang:");
  return lines.join("\n");
};

// Shared swap attempt: runs on the initial pick and the post-sponsor "qayta urinish" retry.
// On the sponsor-gate error it shows the new player's missing channels + a retry button
// (session is kept, so the leader needn't re-pick the players).
const attemptSwap = async (ctx, state) => {
  try {
    await swapRosterMember(ctx.from.id, state.registrationId, state.outUserId, state.inUserId);
    ctx.session.swap = null;
    await ctx.answerCallbackQuery({ text: "Almashtirildi" });
    await ctx.editMessageText(
      `✅ <b>${state.tournamentTitle}</b> - o'yinchi almashtirildi.`,
      { parse_mode: "HTML" },
    );
    await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
  } catch (err) {
    const data = err?.response?.data;
    // Yangi o'yinchi homiy kanallarga obuna emas: kanallar + "qayta urinish" tugmasi.
    if (data?.details?.channels?.length) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "❗ Yangi o'yinchi quyidagi homiy kanal(lar)ga obuna bo'lishi shart. " +
          'U obuna bo\'lgach "🔄 Tekshirish / Qayta urinish"ni bosing:',
        { reply_markup: buildSponsorChannelsKeyboard(data.details.channels, "swapretry") },
      );
      return;
    }
    const message = data?.message || "Almashtirishda xato";
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    logger.warn({ err: err.message }, "swapRosterMember failed");
  }
};

// swap:<registrationId> - "Mening turnirlarim"dan o'yinchi almashtirishni boshlaydi.
export const handleSwapStart = async (ctx) => {
  const registrationId = ctx.callbackQuery.data.split(":")[1];
  let data;
  try {
    data = await fetchRosterForSwap(ctx.from.id, registrationId);
  } catch (err) {
    const msg = err?.response?.data?.message || "Ma'lumotni yuklab bo'lmadi";
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
    logger.warn({ err: err.message }, "fetchRosterForSwap failed");
    return;
  }
  if (!data.candidates?.length) {
    await ctx.answerCallbackQuery({
      text: "Almashtirish uchun bo'sh komanda a'zosi yo'q. Avval komandaga yangi a'zo qo'shing.",
      show_alert: true,
    });
    return;
  }

  ctx.session ||= {};
  ctx.session.swap = {
    registrationId: data.registrationId,
    tournamentTitle: data.tournamentTitle,
    mode: data.mode,
    roster: data.roster,
    candidates: data.candidates,
    outUserId: null,
    inUserId: null,
  };
  await ctx.answerCallbackQuery();
  await ctx.reply(swapIntroText(ctx.session.swap), {
    parse_mode: "HTML",
    reply_markup: buildSwapOutKeyboard(data.roster),
  });
};

// swapout:<userId> - rosterdan chiqariladigan o'yinchi tanlandi; o'rinbosarlar ro'yxatini ko'rsatadi.
export const handleSwapOut = async (ctx) => {
  const state = ctx.session?.swap;
  if (!state) {
    await ctx.answerCallbackQuery({
      text: "Sessiya muddati o'tdi. Qaytadan urinib ko'ring.",
      show_alert: true,
    });
    return;
  }
  const userId = ctx.callbackQuery.data.split(":")[1];
  const out = state.roster.find((r) => r.userId === userId);
  if (!out) {
    await ctx.answerCallbackQuery({ text: "Bu o'yinchi rosterda yo'q", show_alert: true });
    return;
  }
  state.outUserId = userId;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `🔄 <b>${out.name}</b> o'rniga kimni qo'yamiz? Yangi o'yinchini tanlang:`,
    { parse_mode: "HTML", reply_markup: buildSwapInKeyboard(state.candidates) },
  );
};

// swapin:<userId> - o'rinbosar tanlandi; almashtirishni amalga oshiradi.
export const handleSwapIn = async (ctx) => {
  const state = ctx.session?.swap;
  if (!state?.outUserId) {
    await ctx.answerCallbackQuery({
      text: "Sessiya muddati o'tdi. Qaytadan urinib ko'ring.",
      show_alert: true,
    });
    return;
  }
  const userId = ctx.callbackQuery.data.split(":")[1];
  if (!state.candidates.some((m) => m._id === userId)) {
    await ctx.answerCallbackQuery({ text: "Bu a'zo komandada yo'q", show_alert: true });
    return;
  }
  state.inUserId = userId;
  await attemptSwap(ctx, state);
};

// swapretry - yangi o'yinchi homiy kanallarga obuna bo'lgach almashtirishni qayta urinadi.
export const handleSwapRetry = async (ctx) => {
  const state = ctx.session?.swap;
  if (!state?.outUserId || !state?.inUserId) {
    await ctx.answerCallbackQuery({
      text: "Sessiya muddati o'tdi. Qaytadan urinib ko'ring.",
      show_alert: true,
    });
    return;
  }
  await attemptSwap(ctx, state);
};

// swapcancel - o'yinchi almashtirishni bekor qiladi.
export const handleSwapCancel = async (ctx) => {
  ctx.session ||= {};
  ctx.session.swap = null;
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  try {
    await ctx.editMessageText("O'yinchi almashtirish bekor qilindi.");
  } catch (err) {
    logger.warn({ err: err.message }, "swap cancel edit failed");
  }
};
