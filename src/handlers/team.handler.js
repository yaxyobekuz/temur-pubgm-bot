import { InlineKeyboard } from "grammy";
import {
  leaderTeamKeyboard,
  playerTeamKeyboard,
  noTeamLeaderKeyboard,
} from "../keyboards/team.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import {
  fetchMyTeam,
  createTeam,
  updateOwnTeam,
  regenerateInvite,
  kickMember,
  leaveTeam,
  fetchMe,
} from "../services/backend.service.js";
import logger from "../config/logger.js";

const memberLine = (m, leaderId) => {
  const name =
    [m.firstName, m.lastName].filter(Boolean).join(" ") ||
    m.tgUsername ||
    m.username ||
    "O'yinchi";
  const tag = String(m._id) === String(leaderId) ? " 👑" : "";
  return `• ${name}${tag}`;
};

const formatTeam = (team) => {
  const leaderId = team.leader?._id || team.leader;
  const lines = [
    `👥 *${team.name}*`,
    `A'zolar: ${team.members?.length || 0} / 100`,
    "",
    ...(team.members || []).map((m) => memberLine(m, leaderId)),
  ];
  return lines.join("\n");
};

export const showTeam = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }

  let team = null;
  try {
    team = await fetchMyTeam(ctx.from.id);
  } catch (err) {
    logger.error({ err: err.message }, "fetchMyTeam failed");
  }

  if (!team) {
    if (user.role === "leader") {
      await ctx.reply(
        "Sizda hali komanda yo'q. Yangi komanda yaratasizmi?",
        { reply_markup: noTeamLeaderKeyboard },
      );
    } else {
      await ctx.reply(
        "Siz hech qaysi komandada emassiz. Komanda sardori sizni taklif havolasi orqali qo'shadi.",
      );
    }
    return;
  }

  const isLeader =
    String(team.leader?._id || team.leader) === String(user._id);
  await ctx.reply(formatTeam(team), {
    parse_mode: "Markdown",
    reply_markup: isLeader ? leaderTeamKeyboard : playerTeamKeyboard,
  });
};

// Free-text inputs are captured via simple "awaiting" hints stored in session.
// To keep the bot scaffold lightweight we use grammY's conversations only for register;
// for one-shot inputs (team name, kick pick) we do a brief follow-up message pattern.

export const startCreateTeam = async (ctx) => {
  const user = ctx.state?.user;
  if (!user || user.role !== "leader") {
    await ctx.reply("Faqat leader komanda yarata oladi.");
    return;
  }
  ctx.session ||= {};
  ctx.session.await = "team:create:name";
  await ctx.reply("Komanda nomini yuboring:");
};

export const startRenameTeam = async (ctx) => {
  const user = ctx.state?.user;
  if (!user || user.role !== "leader") return;
  ctx.session ||= {};
  ctx.session.await = "team:rename";
  await ctx.reply("Yangi nomni yuboring:");
};

export const startKickMember = async (ctx) => {
  const user = ctx.state?.user;
  if (!user || user.role !== "leader") return;
  let team;
  try {
    team = await fetchMyTeam(ctx.from.id);
  } catch (err) {
    logger.error({ err: err.message }, "fetchMyTeam failed");
    return;
  }
  if (!team) return;
  const leaderId = String(team.leader?._id || team.leader);
  const others = (team.members || []).filter((m) => String(m._id) !== leaderId);
  if (!others.length) {
    await ctx.reply("Chiqarib yuboriladigan a'zo yo'q.");
    return;
  }
  const kb = new InlineKeyboard();
  others.forEach((m, i) => {
    const name =
      [m.firstName, m.lastName].filter(Boolean).join(" ") ||
      m.tgUsername ||
      "O'yinchi";
    kb.text(name, `kick:${m._id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  await ctx.reply("Kimni chiqarib yuborasiz?", { reply_markup: kb });
};

export const handleKickCallback = async (ctx) => {
  const memberId = ctx.callbackQuery.data.split(":")[1];
  try {
    await kickMember(ctx.from.id, memberId);
    await ctx.answerCallbackQuery({ text: "Chiqarildi" });
    await ctx.editMessageText("O'yinchi komandadan chiqarildi.");
  } catch (err) {
    const msg = err?.response?.data?.message || "Xato";
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
  }
};

export const handleRegenerateInvite = async (ctx) => {
  try {
    const team = await regenerateInvite(ctx.from.id);
    const me = await ctx.api.getMe();
    const link = `https://t.me/${me.username}?start=${team.inviteCode}`;
    await ctx.reply(`Yangi taklif havolasi:\n${link}`);
  } catch (err) {
    const msg = err?.response?.data?.message || "Xato";
    await ctx.reply(msg);
  }
};

export const handleShowInvite = async (ctx) => {
  try {
    const team = await fetchMyTeam(ctx.from.id);
    if (!team) {
      await ctx.reply("Komanda topilmadi.");
      return;
    }
    const me = await ctx.api.getMe();
    const link = `https://t.me/${me.username}?start=${team.inviteCode}`;
    await ctx.reply(`Taklif havolasi:\n${link}`);
  } catch (err) {
    const msg = err?.response?.data?.message || "Xato";
    await ctx.reply(msg);
  }
};

export const handleLeaveTeam = async (ctx) => {
  try {
    await leaveTeam(ctx.from.id);
    await ctx.reply("Komandadan chiqdingiz.", { reply_markup: cabinetKeyboard });
  } catch (err) {
    const msg = err?.response?.data?.message || "Xato";
    await ctx.reply(msg);
  }
};

// Text catcher - completes pending one-shot inputs (team:create:name, team:rename).
export const handlePendingTextInput = async (ctx, next) => {
  const awaiting = ctx.session?.await;
  if (!awaiting) return next();
  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith("/") || text.startsWith("⬅") || text.startsWith("👤")) {
    return next();
  }

  ctx.session.await = null;
  try {
    if (awaiting === "team:create:name") {
      await createTeam(ctx.from.id, { name: text });
      await ctx.reply("Komanda yaratildi!", { reply_markup: cabinetKeyboard });
      ctx.state.user = await fetchMe(ctx.from.id).catch(() => ctx.state.user);
    } else if (awaiting === "team:rename") {
      await updateOwnTeam(ctx.from.id, { name: text });
      await ctx.reply("Nom yangilandi.", { reply_markup: cabinetKeyboard });
    } else {
      return next();
    }
  } catch (err) {
    const msg = err?.response?.data?.message || "Xato";
    await ctx.reply(msg, { reply_markup: cabinetKeyboard });
  }
};
