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
import {
  MODE_ROSTER_SIZE,
  countMain,
  buildRosterStatusText,
  buildRosterKeyboard,
  toggleSlot,
  slotsToRoster,
} from "./rosterPicker.shared.js";
import logger from "../config/logger.js";

const KIND_LABEL = { advanced: "keyingi bosqichga o'tdingiz", vip: "VIP slot oldingiz" };

// Placement-flow roster picker uses its own callback prefixes (won't clash with register's).
const PLACE_CB = { toggle: "placeslot", submit: "placeroster:submit", cancel: "placeroster:cancel" };

const placeRosterText = (state) =>
  buildRosterStatusText({
    heading: `🎟 <b>${state.tournamentTitle}</b> - asosiy o'yinchilarni tanlang`,
    mode: state.mode,
    required: MODE_ROSTER_SIZE[state.mode] || 0,
    slots: state.slots,
  });

const placeRosterKeyboard = (state) =>
  buildRosterKeyboard(
    state.members,
    state.slots,
    MODE_ROSTER_SIZE[state.mode] || 0,
    PLACE_CB,
  );

const getState = (ctx) => ctx.session?.placement || null;

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
    needsRoster: pending.needsRoster === true,
    mode: pending.mode,
    members: pending.members || [],
    slots: {},
    roster: null,
  };

  // Brand-new VIP team has no roster yet - pick it before choosing a day/time slot.
  if (ctx.session.placement.needsRoster) {
    await ctx.reply(placeRosterText(ctx.session.placement), {
      parse_mode: "HTML",
      reply_markup: placeRosterKeyboard(ctx.session.placement),
    });
    return;
  }

  const note = KIND_LABEL[pending.kind] || "keyingi bosqichga o'tdingiz";
  await ctx.reply(
    `🎟 <b>${ctx.session.placement.tournamentTitle}</b> - siz ${note}.\nBo'sh kunni tanlang:`,
    { parse_mode: "HTML", reply_markup: buildDayPickerKeyboard(pending.openSlots, "place") },
  );
};

// placeslot:<userId> - toggle a member's roster slot (VIP placement only).
export const handlePlaceSlot = async (ctx) => {
  const state = getState(ctx);
  if (!state?.needsRoster) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  const userId = ctx.callbackQuery.data.split(":")[1];
  if (!state.members.some((m) => m._id === userId)) {
    await ctx.answerCallbackQuery({ text: "Bu a'zo komandada yo'q", show_alert: true });
    return;
  }
  toggleSlot(state.slots, userId, MODE_ROSTER_SIZE[state.mode] || 0);
  await ctx.answerCallbackQuery();
  try {
    await ctx.editMessageText(placeRosterText(state), {
      parse_mode: "HTML",
      reply_markup: placeRosterKeyboard(state),
    });
  } catch (err) {
    logger.warn({ err: err.message }, "place roster edit failed");
  }
};

// placeroster:submit - roster done, move to the day picker.
export const handlePlaceRosterSubmit = async (ctx) => {
  const state = getState(ctx);
  if (!state?.needsRoster) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  const required = MODE_ROSTER_SIZE[state.mode] || 0;
  if (countMain(state.slots) !== required) {
    await ctx.answerCallbackQuery({
      text: `Aynan ${required} ta asosiy o'yinchi tanlang`,
      show_alert: true,
    });
    return;
  }
  state.roster = slotsToRoster(state.slots);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Endi bo'sh kunni tanlang:", {
    reply_markup: buildDayPickerKeyboard(state.openSlots, "place"),
  });
};

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

// Shared placement attempt: uses the day/time saved on the session so both the initial pick and
// the post-secret-group "qayta urinish" can run it. On the secret-group error it shows the join
// link + a retry button (state is kept, so the leader needn't re-pick roster/day/time).
const attemptPlacement = async (ctx, state) => {
  try {
    await placeIntoStage(ctx.from.id, state.registrationId, state.lastDay, state.lastTimeSlot, state.roster);
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
    if (data?.details?.secretGroup?.url) {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "❗ Avval ushbu bosqich guruhining maxfiy guruhiga qo'shiling, so'ng \"🔄 Tekshirish / Qayta urinish\"ni bosing:",
        { reply_markup: buildSecretGroupKeyboard(data.details.secretGroup, "secretretry:place") },
      );
      return;
    }
    const message = data?.message || "Joy tanlashda xato";
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    logger.warn({ err: err.message }, "placeIntoStage failed");
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
  state.lastDay = day;
  state.lastTimeSlot = timeSlot;
  await attemptPlacement(ctx, state);
};

// secretretry:place - leader maxfiy guruhga qo'shilgach bosadi; saqlangan kun/vaqt bilan
// joy tanlashni qayta urinadi.
export const handleSecretRetryPlace = async (ctx) => {
  const state = getState(ctx);
  if (!state || state.lastDay == null || state.lastTimeSlot == null) {
    await ctx.answerCallbackQuery({ text: "Sessiya muddati o'tdi", show_alert: true });
    return;
  }
  await attemptPlacement(ctx, state);
};
