import {
  getTournamentById,
  fetchMyTeam,
  registerForTournament,
} from "../services/backend.service.js";
import {
  buildRosterPickerKeyboard,
  buildSponsorChannelsKeyboard,
  buildSecretGroupKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import logger from "../config/logger.js";

const MODE_ROSTER_SIZE = { solo: 1, duo: 2, squad: 4 };

const buildStatusText = (tournament, required, slots) => {
  const main = Object.values(slots).filter((s) => s === "main").length;
  const reserve = Object.values(slots).filter((s) => s === "reserve").length;
  return [
    `📝 <b>${tournament.title}</b> - ro'yxatdan o'tish`,
    "",
    `Rejim: <b>${tournament.mode}</b> (aynan <b>${required}</b> ta asosiy o'yinchi kerak)`,
    `Tanlangan asosiy: <b>${main}/${required}</b> • Zaxira: <b>${reserve}</b>`,
    "",
    "Har bir a'zoni bosib slotni almashtirib turing.",
    "Belgilar: <b>★</b> asosiy · <b>◌</b> zaxira · <b>·</b> tanlanmagan",
  ].join("\n");
};

const renderKeyboard = (members, slots, required) => {
  const main = Object.values(slots).filter((s) => s === "main").length;
  return buildRosterPickerKeyboard(members, slots, main === required);
};

// "📝 Ro'yxatdan o'tish" tugmasi - roster picker'ni ochadi.
export const handleStartRegister = async (ctx) => {
  const tournamentId = ctx.callbackQuery.data.split(":")[1];
  const user = ctx.state?.user;
  if (!user) {
    await ctx.answerCallbackQuery({ text: "Avval /start", show_alert: true });
    return;
  }
  if (user.role !== "leader") {
    await ctx.answerCallbackQuery({
      text: "Faqat leader ro'yxatdan o'tkaza oladi",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  let tournament;
  let team;
  try {
    [tournament, team] = await Promise.all([
      getTournamentById(tournamentId),
      fetchMyTeam(ctx.from.id),
    ]);
  } catch (err) {
    logger.warn({ err: err.message }, "register preload failed");
    await ctx.reply("Ma'lumotlarni yuklab bo'lmadi.", {
      reply_markup: cabinetKeyboard,
    });
    return;
  }

  if (!team) {
    await ctx.reply("Avval o'z komandangizni yarating.", {
      reply_markup: cabinetKeyboard,
    });
    return;
  }

  const required = MODE_ROSTER_SIZE[tournament.mode] || 0;
  if (!required) {
    await ctx.reply("Turnir rejimi noto'g'ri.");
    return;
  }

  const members = team.members || [];
  const slots = {};

  ctx.session ||= {};
  ctx.session.roster = {
    tournamentId: String(tournament._id),
    tournamentTitle: tournament.title,
    tournamentMode: tournament.mode,
    members: members.map((m) => ({
      _id: String(m._id),
      firstName: m.firstName,
      lastName: m.lastName,
      tgUsername: m.tgUsername,
    })),
    slots,
  };

  await ctx.reply(buildStatusText(tournament, required, slots), {
    parse_mode: "HTML",
    reply_markup: renderKeyboard(members, slots, required),
  });
};

const getState = (ctx) => ctx.session?.roster || null;

// slot:<userId> - toggle slot for member.
export const handleSlotToggle = async (ctx) => {
  const state = getState(ctx);
  if (!state) {
    await ctx.answerCallbackQuery({
      text: "Sessiya muddati o'tdi. Qaytadan urinib ko'ring.",
      show_alert: true,
    });
    return;
  }

  const userId = ctx.callbackQuery.data.split(":")[1];
  if (!state.members.some((m) => m._id === userId)) {
    await ctx.answerCallbackQuery({
      text: "Bu a'zo komandada yo'q",
      show_alert: true,
    });
    return;
  }

  const required = MODE_ROSTER_SIZE[state.tournamentMode] || 0;
  const cur = state.slots[userId];
  if (!cur) state.slots[userId] = "main";
  else if (cur === "main") state.slots[userId] = "reserve";
  else delete state.slots[userId];

  const main = Object.values(state.slots).filter((s) => s === "main").length;
  if (main > required && state.slots[userId] === "main") {
    state.slots[userId] = "reserve";
  }

  await ctx.answerCallbackQuery();
  try {
    await ctx.editMessageText(
      buildStatusText(
        { title: state.tournamentTitle, mode: state.tournamentMode },
        required,
        state.slots,
      ),
      {
        parse_mode: "HTML",
        reply_markup: renderKeyboard(state.members, state.slots, required),
      },
    );
  } catch (err) {
    logger.warn({ err: err.message }, "roster edit failed");
  }
};

export const handleRosterCancel = async (ctx) => {
  ctx.session ||= {};
  ctx.session.roster = null;
  await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  try {
    await ctx.editMessageText("Ro'yxatdan o'tish bekor qilindi.");
  } catch (err) {
    logger.warn({ err: err.message }, "cancel edit failed");
  }
};

export const handleRosterSubmit = async (ctx) => {
  const state = getState(ctx);
  if (!state) {
    await ctx.answerCallbackQuery({
      text: "Sessiya muddati o'tdi. Qaytadan urinib ko'ring.",
      show_alert: true,
    });
    return;
  }

  const required = MODE_ROSTER_SIZE[state.tournamentMode] || 0;
  const main = Object.values(state.slots).filter((s) => s === "main").length;
  if (main !== required) {
    await ctx.answerCallbackQuery({
      text: `Aynan ${required} ta asosiy o'yinchi tanlang`,
      show_alert: true,
    });
    return;
  }

  const roster = Object.entries(state.slots).map(([user, slot], i) => ({
    user,
    slot,
    position: i,
  }));

  try {
    await registerForTournament(ctx.from.id, state.tournamentId, roster);
    ctx.session.roster = null;
    await ctx.answerCallbackQuery({ text: "Yuborildi" });
    await ctx.editMessageText(
      `✅ <b>${state.tournamentTitle}</b> turniriga ro'yxatdan o'tildi.`,
      { parse_mode: "HTML" },
    );
    await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
  } catch (err) {
    const data = err?.response?.data;
    if (Array.isArray(data?.details) && data.details.length) {
      await ctx.answerCallbackQuery({
        text: "Avval kanallarga obuna bo'ling",
        show_alert: true,
      });
      await ctx.editMessageText(
        "❗ Quyidagi homiy kanallarga obuna bo'ling va qaytadan urinib ko'ring:",
        { reply_markup: buildSponsorChannelsKeyboard(data.details) },
      );
      return;
    }
    if (data?.secretGroup?.url) {
      await ctx.answerCallbackQuery({
        text: "Avval maxfiy guruhga qo'shiling",
        show_alert: true,
      });
      await ctx.editMessageText(
        "❗ Avval ushbu turnirning maxfiy guruhiga qo'shiling va qaytadan urinib ko'ring:",
        { reply_markup: buildSecretGroupKeyboard(data.secretGroup) },
      );
      return;
    }
    const message = data?.message || "Ro'yxatdan o'tishda xato";
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    logger.warn({ err: err.message }, "register failed");
  }
};
