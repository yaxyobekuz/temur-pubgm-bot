import {
  getTournamentById,
  fetchMyTeam,
  registerForTournament,
} from "../services/backend.service.js";
import {
  buildRosterPickerKeyboard,
  buildSponsorChannelsKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import logger from "../config/logger.js";

const MODE_ROSTER_SIZE = { solo: 1, duo: 2, squad: 4 };

const memberName = (m) =>
  [m.firstName, m.lastName].filter(Boolean).join(" ") ||
  m.tgUsername ||
  m.username ||
  "O'yinchi";

const buildStatusText = (tournament, members, slots) => {
  const required = MODE_ROSTER_SIZE[tournament.mode] || 0;
  const main = Object.values(slots).filter((s) => s === "main").length;
  const reserve = Object.values(slots).filter((s) => s === "reserve").length;
  return [
    `📝 <b>${tournament.title}</b> — ro'yxatdan o'tish`,
    "",
    `Rejim: <b>${tournament.mode}</b> (aynan <b>${required}</b> ta asosiy o'yinchi kerak)`,
    `Tanlangan asosiy: <b>${main}/${required}</b> • Zaxira: <b>${reserve}</b>`,
    "",
    "Har bir a'zoni bosib slotni almashtirib turing.",
    "Belgilar: <b>★</b> asosiy · <b>◌</b> zaxira · <b>·</b> tanlanmagan",
  ].join("\n");
};

// Conversation: roster picker. Submit yoki Cancel'gacha davom etadi.
export const registerTournamentConversation = async (conversation, ctx) => {
  const tournamentId = ctx.session?.pendingRegisterTournamentId;
  if (!tournamentId) {
    await ctx.reply("Turnir tanlanmagan.");
    return;
  }
  // Bir martalik ishlatib bo'sh qilish.
  ctx.session.pendingRegisterTournamentId = null;

  let tournament;
  let team;
  try {
    [tournament, team] = await conversation.external(() =>
      Promise.all([getTournamentById(tournamentId), fetchMyTeam(ctx.from.id)]),
    );
  } catch (err) {
    logger.warn({ err: err.message }, "register-conv preload failed");
    await ctx.reply("Ma'lumotlarni yuklab bo'lmadi.", { reply_markup: cabinetKeyboard });
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
  const slots = {}; // { [userId]: 'main' | 'reserve' | undefined }

  const renderKeyboard = () => {
    const main = Object.values(slots).filter((s) => s === "main").length;
    return buildRosterPickerKeyboard(members, slots, main === required);
  };

  const msg = await ctx.reply(buildStatusText(tournament, members, slots), {
    parse_mode: "HTML",
    reply_markup: renderKeyboard(),
  });

  while (true) {
    const update = await conversation.waitForCallbackQuery(
      /^(slot:|roster:submit|roster:cancel)/,
      {
        otherwise: (innerCtx) =>
          innerCtx.reply("Iltimos, tugmalar orqali tanlang."),
      },
    );
    const data = update.callbackQuery.data;

    if (data === "roster:cancel") {
      await update.answerCallbackQuery({ text: "Bekor qilindi" });
      await update.api.editMessageText(
        ctx.chat.id,
        msg.message_id,
        "Ro'yxatdan o'tish bekor qilindi.",
      );
      return;
    }

    if (data === "roster:submit") {
      const main = Object.values(slots).filter((s) => s === "main").length;
      if (main !== required) {
        await update.answerCallbackQuery({
          text: `Aynan ${required} ta asosiy o'yinchi tanlang`,
          show_alert: true,
        });
        continue;
      }

      const roster = Object.entries(slots).map(([user, slot], i) => ({
        user,
        slot,
        position: i,
      }));

      try {
        await conversation.external(() =>
          registerForTournament(ctx.from.id, tournament._id, roster),
        );
        await update.answerCallbackQuery({ text: "Yuborildi" });
        await update.api.editMessageText(
          ctx.chat.id,
          msg.message_id,
          `✅ <b>${tournament.title}</b> turniriga ro'yxatdan o'tildi.`,
          { parse_mode: "HTML" },
        );
        await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
      } catch (err) {
        const data = err?.response?.data;
        // Sponsor channel rejection — details = [{title,url}, ...]
        if (Array.isArray(data?.details) && data.details.length) {
          await update.answerCallbackQuery({
            text: "Avval kanallarga obuna bo'ling",
            show_alert: true,
          });
          await update.api.editMessageText(
            ctx.chat.id,
            msg.message_id,
            "❗ Quyidagi homiy kanallarga obuna bo'ling va qaytadan urinib ko'ring:",
            { reply_markup: buildSponsorChannelsKeyboard(data.details) },
          );
          return;
        }
        const message = data?.message || "Ro'yxatdan o'tishda xato";
        await update.answerCallbackQuery({ text: message, show_alert: true });
        logger.warn({ err: err.message }, "register failed");
      }
      return;
    }

    // slot:<userId>
    const userId = data.split(":")[1];
    if (!members.some((m) => String(m._id) === String(userId))) {
      await update.answerCallbackQuery({ text: "Bu a'zo komandada yo'q", show_alert: true });
      continue;
    }
    // Cycle: undefined → main → reserve → undefined
    const cur = slots[userId];
    if (!cur) slots[userId] = "main";
    else if (cur === "main") slots[userId] = "reserve";
    else delete slots[userId];

    // Asosiy limitidan oshmasin.
    const main = Object.values(slots).filter((s) => s === "main").length;
    if (main > required && slots[userId] === "main") {
      slots[userId] = "reserve";
    }

    await update.answerCallbackQuery();
    try {
      await update.api.editMessageText(
        ctx.chat.id,
        msg.message_id,
        buildStatusText(tournament, members, slots),
        { parse_mode: "HTML", reply_markup: renderKeyboard() },
      );
    } catch {
      // Edit fail (e.g. xabar o'zgarmagan) — jim qoldiramiz.
    }
  }
};

export const REGISTER_TOURNAMENT_CONVERSATION = "registerTournamentConversation";

// Detail card "📝 Ro'yxatdan o'tish" tugmasini bosgandan keyin ishlovchi callback.
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
  ctx.session ||= {};
  ctx.session.pendingRegisterTournamentId = tournamentId;
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter(REGISTER_TOURNAMENT_CONVERSATION);
};
