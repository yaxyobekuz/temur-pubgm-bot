import {
  getTournamentById,
  fetchMyTeam,
  fetchOpenSlots,
  checkSponsorMembership,
  registerForTournament,
  updateContactUsername,
  fetchMe,
} from "../services/backend.service.js";
import {
  buildSponsorChannelsKeyboard,
  buildSecretGroupKeyboard,
  buildDayPickerKeyboard,
  buildTimePickerKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { noTeamLeaderKeyboard } from "../keyboards/team.keyboard.js";
import { sendBannerPhoto } from "./tournaments.handler.js";
import {
  MODE_ROSTER_SIZE,
  countMain,
  buildRosterStatusText,
  buildRosterKeyboard,
  toggleSlot,
  slotsToRoster,
} from "./rosterPicker.shared.js";
import { parseUsername } from "../utils/parseUsername.js";
import logger from "../config/logger.js";

const buildStatusText = (tournament, required, slots) =>
  buildRosterStatusText({
    heading: `📝 <b>${tournament.title}</b> - ro'yxatdan o'tish`,
    mode: tournament.mode,
    required,
    slots,
  });

const renderKeyboard = (members, slots, required) =>
  buildRosterKeyboard(members, slots, required);

// Roster picker'ni ochadi - turnir/komanda yuklab, slot tanlash holatini sessiyaga yozadi.
const openRosterPicker = async (ctx, tournamentId) => {
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

  // Ro'yxatdan o'tish boshida turnir bannerini ko'rsatamiz (bo'lsa).
  await sendBannerPhoto(ctx, tournament).catch(() => {});

  await ctx.reply(buildStatusText(tournament, required, slots), {
    parse_mode: "HTML",
    reply_markup: renderKeyboard(members, slots, required),
  });
};

// Homiy kanal obunasini (butun komanda) tekshiradi. Hammasi obuna bo'lsa - roster picker.
// Aks holda - obuna bo'lmagan a'zolar ismlari + kanal tugmalari + "Tekshirish".
// `edit` true bo'lsa mavjud xabar tahrirlanadi (Tekshirish bosilganida).
const runSponsorGate = async (ctx, tournamentId, { edit = false } = {}) => {
  let res;
  try {
    res = await checkSponsorMembership(ctx.from.id, tournamentId);
  } catch (err) {
    logger.warn({ err: err.message }, "sponsor-check failed");
    const msg = err?.response?.data?.message || "Tekshirib bo'lmadi. Keyinroq urinib ko'ring.";
    await ctx.reply(msg, { reply_markup: cabinetKeyboard });
    return;
  }

  if (res.ok) {
    await openRosterPicker(ctx, tournamentId);
    return;
  }

  ctx.session ||= {};
  ctx.session.sponsorTournamentId = tournamentId;
  const names = (res.members || []).map((m) => `- ${m.name}`).join("\n");
  const text = `❗ Quyidagi a'zolar homiy kanallarga obuna emas:\n<b>${names || "-"}</b>\n\n⚠️ Diqqat! Homiy kanallardan chiqib ketgan taqdirda, siz va jamoangiz turnirdan chetlatilishingiz mumkin.\n\nObuna bo'lib, "🔄 Tekshirish"ni bosing:`;
  const opts = {
    parse_mode: "HTML",
    reply_markup: buildSponsorChannelsKeyboard(res.channels),
  };
  if (edit) await ctx.editMessageText(text, opts);
  else await ctx.reply(text, opts);
};

// "📝 Ro'yxatdan o'tish" tugmasi - obunani tekshiradi, so'ng roster picker'ni ochadi.
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

  // Leader bo'lsa-yu hali komandasi bo'lmasa (ro'yxatdan o'tishda leader roli darhol
  // beriladi, komanda esa keyin yaratiladi) - sponsor-gate "komandangiz topilmadi" deb
  // tushunarsiz xato bermasin. Avval komanda yaratishni taklif qilamiz.
  let team;
  try {
    team = await fetchMyTeam(ctx.from.id);
  } catch (err) {
    logger.warn({ err: err.message }, "register team preload failed");
    await ctx.reply("Ma'lumotlarni yuklab bo'lmadi.", { reply_markup: cabinetKeyboard });
    return;
  }
  if (!team) {
    await ctx.reply(
      "Turnirda ro'yxatdan o'tish uchun avval o'z komandangizni yarating.",
      { reply_markup: noTeamLeaderKeyboard },
    );
    return;
  }

  // Aloqa username bo'lmasa - joyida so'rab, kiritgach davom etadi.
  if (!user.contactUsername) {
    ctx.session ||= {};
    ctx.session.await = "register:contact-username";
    ctx.session.pendingRegisterTournamentId = tournamentId;
    await ctx.reply(
      "Turnirga qo'shilishdan oldin aloqa username kiriting (@username yoki t.me/...):",
    );
    return;
  }

  await runSponsorGate(ctx, tournamentId);
};

// register:contact-username await holatini yakunlaydi (team.handler dispatcher chaqiradi).
export const completeRegisterContactUsername = async (ctx, text) => {
  const username = parseUsername(text);
  if (!username) {
    await ctx.reply(
      "Username noto'g'ri. Masalan: @username yoki t.me/username",
      { reply_markup: cabinetKeyboard },
    );
    return;
  }

  const tournamentId = ctx.session?.pendingRegisterTournamentId;
  ctx.session.pendingRegisterTournamentId = null;

  try {
    await updateContactUsername(ctx.from.id, username);
    ctx.state.user = await fetchMe(ctx.from.id).catch(() => ctx.state.user);
  } catch (err) {
    const msg = err?.response?.data?.message || "Saqlashda xato";
    await ctx.reply(msg, { reply_markup: cabinetKeyboard });
    return;
  }

  await ctx.reply(`✅ Aloqa username saqlandi: @${username}`);
  if (tournamentId) await runSponsorGate(ctx, tournamentId);
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
  toggleSlot(state.slots, userId, required);

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
  if (countMain(state.slots) !== required) {
    await ctx.answerCallbackQuery({
      text: `Aynan ${required} ta asosiy o'yinchi tanlang`,
      show_alert: true,
    });
    return;
  }

  state.roster = slotsToRoster(state.slots);

  // Load the open day/time slots and move to the cascading slot picker.
  let openSlots;
  try {
    openSlots = await fetchOpenSlots(state.tournamentId);
  } catch (err) {
    logger.warn({ err: err.message }, "fetchOpenSlots failed");
    await ctx.answerCallbackQuery({ text: "Bo'sh vaqtlarni yuklab bo'lmadi", show_alert: true });
    return;
  }
  if (!openSlots?.days?.length) {
    await ctx.answerCallbackQuery({ text: "Bo'sh joy qolmadi", show_alert: true });
    await ctx.editMessageText("Afsuski, bu turnirda bo'sh joy qolmadi.");
    return;
  }

  state.openSlots = openSlots;
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Qaysi kun siz uchun qulay? Bo'sh kunni tanlang:", {
    reply_markup: buildDayPickerKeyboard(openSlots),
  });
};

// slotday:<day> - day chosen, show the time picker for that day.
export const handleSlotDay = async (ctx) => {
  const state = getState(ctx);
  if (!state?.roster) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  const day = Number(ctx.callbackQuery.data.split(":")[1]);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Endi bo'sh vaqtni tanlang:", {
    reply_markup: buildTimePickerKeyboard(day, state.openSlots),
  });
};

// slot:back - return to the day picker.
export const handleSlotBack = async (ctx) => {
  const state = getState(ctx);
  if (!state?.openSlots) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Bo'sh kunni tanlang:", {
    reply_markup: buildDayPickerKeyboard(state.openSlots),
  });
};

// Ro'yxatdan o'tishni yakunlaydi (day/timeSlot sessiyada saqlangan bo'lishi kerak).
// handleSlotTime va handleSubCheck (qayta tekshirish) ikkalasi ham shuni ishlatadi.
const finishRegistration = async (ctx, state) => {
  try {
    await registerForTournament(
      ctx.from.id,
      state.tournamentId,
      state.roster,
      state.lastDay,
      state.lastTimeSlot,
    );
    ctx.session.roster = null;
    await ctx.editMessageText(
      `✅ <b>${state.tournamentTitle}</b> turniriga ro'yxatdan o'tildi.`,
      { parse_mode: "HTML" },
    );
    await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
  } catch (err) {
    const data = err?.response?.data;
    // Homiy kanal obunasi "Ro'yxatdan o'tish" bosilganda erta tekshiriladi; bu yerda faqat
    // maxfiy guruh (leader-only) qoladi. Sponsor xatosi kelsa - umumiy xabarga tushadi.
    if (data?.details?.secretGroup?.url) {
      await ctx.editMessageText(
        "❗ Avval ushbu turnirning maxfiy guruhiga qo'shiling, so'ng \"🔄 Tekshirish / Qayta urinish\"ni bosing:",
        { reply_markup: buildSecretGroupKeyboard(data.details.secretGroup, "secretretry:reg") },
      );
      return;
    }
    const message = data?.message || "Ro'yxatdan o'tishda xato";
    await ctx.reply(message, { reply_markup: cabinetKeyboard });
    logger.warn({ err: err.message }, "register failed");
  }
};

// slottime:<day>:<timeSlot> - time chosen, finalize the registration.
export const handleSlotTime = async (ctx) => {
  const state = getState(ctx);
  if (!state?.roster) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  const [, day, timeSlot] = ctx.callbackQuery.data.split(":").map(Number);
  state.lastDay = day;
  state.lastTimeSlot = timeSlot;
  await ctx.answerCallbackQuery();
  await finishRegistration(ctx, state);
};

// secretretry:reg - leader maxfiy guruhga qo'shilgach bosadi; saqlangan roster/kun/vaqt bilan
// ro'yxatdan o'tishni qayta urinadi (hammasini qaytadan tanlamasdan).
export const handleSecretRetryRegister = async (ctx) => {
  const state = getState(ctx);
  if (!state?.roster || state.lastDay == null || state.lastTimeSlot == null) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi. Qaytadan urinib ko'ring.", show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery({ text: "Tekshirilmoqda..." });
  await finishRegistration(ctx, state);
};

// subcheck - obunani qayta tekshiradi; hamma obuna bo'lsa roster picker ochiladi.
export const handleSubCheck = async (ctx) => {
  const tournamentId = ctx.session?.sponsorTournamentId;
  if (!tournamentId) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  await ctx.answerCallbackQuery({ text: "Tekshirilmoqda..." });
  await runSponsorGate(ctx, tournamentId, { edit: true });
};
