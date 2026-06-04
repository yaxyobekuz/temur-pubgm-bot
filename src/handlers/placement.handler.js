import {
  fetchPendingPlacement,
  placeIntoStage,
} from "../services/backend.service.js";
import {
  buildDayPickerKeyboard,
  buildTimePickerKeyboard,
  buildSecretGroupKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import logger from "../config/logger.js";

const KIND_LABEL = { advanced: "keyingi bosqichga o'tdingiz", vip: "VIP slot oldingiz" };

// "🎟 Bosqich slotini tanlash" - if the team is advanced/VIP-invited, start the cascading
// day -> time picker; otherwise inform the leader there is nothing to place.
export const showPendingPlacement = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }

  let pending;
  try {
    pending = await fetchPendingPlacement(ctx.from.id);
  } catch (err) {
    logger.warn({ err: err.message }, "fetchPendingPlacement failed");
    await ctx.reply("Ma'lumotni yuklab bo'lmadi.");
    return;
  }

  if (!pending) {
    await ctx.reply("Hozircha joy tanlash kerak bo'lgan bosqich yo'q.", {
      reply_markup: cabinetKeyboard,
    });
    return;
  }

  if (pending.scheduleReady === false) {
    await ctx.reply(
      "Keyingi bosqich jadvali hali tayyor emas. Iltimos, keyinroq urinib ko'ring.",
      { reply_markup: cabinetKeyboard },
    );
    return;
  }

  if (!pending.openSlots?.days?.length) {
    await ctx.reply("Afsuski, bu bosqichda bo'sh joy qolmadi. Admin bilan bog'laning.", {
      reply_markup: cabinetKeyboard,
    });
    return;
  }

  ctx.session ||= {};
  ctx.session.placement = {
    registrationId: pending.registrationId,
    tournamentTitle: pending.tournament?.title || "Turnir",
    openSlots: pending.openSlots,
  };

  const note = KIND_LABEL[pending.kind] || "keyingi bosqichga o'tdingiz";
  await ctx.reply(
    `🎟 <b>${ctx.session.placement.tournamentTitle}</b> - siz ${note}.\nBo'sh kunni tanlang:`,
    { parse_mode: "HTML", reply_markup: buildDayPickerKeyboard(pending.openSlots, "place") },
  );
};

const getState = (ctx) => ctx.session?.placement || null;

// placeday:<day>
export const handlePlaceDay = async (ctx) => {
  const state = getState(ctx);
  if (!state) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  const day = Number(ctx.callbackQuery.data.split(":")[1]);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Endi bo'sh vaqtni tanlang:", {
    reply_markup: buildTimePickerKeyboard(day, state.openSlots, "place"),
  });
};

// placeback - back to the day picker.
export const handlePlaceBack = async (ctx) => {
  const state = getState(ctx);
  if (!state) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Bo'sh kunni tanlang:", {
    reply_markup: buildDayPickerKeyboard(state.openSlots, "place"),
  });
};

// placecancel
export const handlePlaceCancel = async (ctx) => {
  ctx.session ||= {};
  ctx.session.placement = null;
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  try {
    await ctx.editMessageText("Bekor qilindi.");
  } catch (err) {
    logger.warn({ err: err.message }, "place cancel edit failed");
  }
};

// placetime:<day>:<timeSlot> - finalize placement into the chosen slot.
export const handlePlaceTime = async (ctx) => {
  const state = getState(ctx);
  if (!state) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  const [, day, timeSlot] = ctx.callbackQuery.data.split(":").map(Number);

  try {
    await placeIntoStage(ctx.from.id, state.registrationId, day, timeSlot);
    ctx.session.placement = null;
    await ctx.answerCallbackQuery({ text: "Joylashdingiz" });
    await ctx.editMessageText(
      `✅ <b>${state.tournamentTitle}</b> - joy tanlandi. Omad tilaymiz!`,
      { parse_mode: "HTML" },
    );
    await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
  } catch (err) {
    const data = err?.response?.data;
    // The chosen group's secret group requires the leader's membership first.
    if (data?.secretGroup?.url) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "❗ Avval ushbu bosqich guruhining maxfiy guruhiga qo'shiling va qaytadan urinib ko'ring:",
        { reply_markup: buildSecretGroupKeyboard(data.secretGroup) },
      );
      return;
    }
    const message = data?.message || "Joy tanlashda xato";
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    logger.warn({ err: err.message }, "placeIntoStage failed");
  }
};
