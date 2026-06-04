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
  updateContactUsername,
} from "../services/backend.service.js";
import { parseUsername } from "../utils/parseUsername.js";
import { fetchAsInputFile } from "../utils/media.js";
import { completeRegisterContactUsername } from "./registerTournament.handler.js";
import { env } from "../config/env.js";
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
  const replyMarkup = isLeader ? leaderTeamKeyboard : playerTeamKeyboard;
  const caption = formatTeam(team);

  if (team.logo || team.logoFileId) {
    const photoOpts = { caption, parse_mode: "Markdown", reply_markup: replyMarkup };
    // Prefer the cached file_id (instant). If it fails (expired/invalid), fall back to the stored file.
    if (team.logoFileId) {
      try {
        await ctx.replyWithPhoto(team.logoFileId, photoOpts);
        return;
      } catch (err) {
        logger.warn({ err: err.message }, "team logo file_id failed, trying stored file");
      }
    }
    if (team.logo) {
      try {
        await ctx.replyWithPhoto(await fetchAsInputFile(team.logo, "logo.jpg"), photoOpts);
        return;
      } catch (err) {
        logger.warn({ err: err.message }, "team logo photo failed, falling back to text");
      }
    }
  }
  await ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
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

export const startSetLogo = async (ctx) => {
  const user = ctx.state?.user;
  if (!user || user.role !== "leader") return;
  ctx.session ||= {};
  ctx.session.await = "team:logo";
  await ctx.reply("Logotip uchun rasm yuboring:");
};

// Photo catcher - only acts when the leader is setting a team logo.
export const handleTeamPhoto = async (ctx, next) => {
  if (ctx.session?.await !== "team:logo") return next();
  ctx.session.await = null;

  const photos = ctx.message?.photo;
  if (!photos?.length) {
    await ctx.reply("Rasm topilmadi. Qaytadan urinib ko'ring.", {
      reply_markup: cabinetKeyboard,
    });
    return;
  }
  const status = await ctx.reply("Yuklanmoqda...");
  try {
    const fileId = photos[photos.length - 1].file_id; // largest size
    const file = await ctx.api.getFile(fileId);
    const logoUrl = `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${file.file_path}`;
    // Send the file_id too so the bot can resend the logo instantly later (no re-upload).
    await updateOwnTeam(ctx.from.id, { logoUrl, logoFileId: fileId });
    await ctx.api.editMessageText(status.chat.id, status.message_id, "Logotip yangilandi ✅");
  } catch (err) {
    logger.error({ err: err.message }, "team logo upload failed");
    const msg = err?.response?.data?.message || "Logotipni yuklab bo'lmadi";
    await ctx.api.editMessageText(status.chat.id, status.message_id, msg);
  }
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
    } else if (awaiting === "settings:contact-username") {
      const username = parseUsername(text);
      if (!username) {
        await ctx.reply(
          "Username noto'g'ri. Masalan: @username yoki t.me/username",
          { reply_markup: cabinetKeyboard },
        );
        return;
      }
      await updateContactUsername(ctx.from.id, username);
      ctx.state.user = await fetchMe(ctx.from.id).catch(() => ctx.state.user);
      await ctx.reply(`✅ Aloqa username saqlandi: @${username}`, {
        reply_markup: cabinetKeyboard,
      });
    } else if (awaiting === "register:contact-username") {
      await completeRegisterContactUsername(ctx, text);
    } else {
      return next();
    }
  } catch (err) {
    const msg = err?.response?.data?.message || "Xato";
    await ctx.reply(msg, { reply_markup: cabinetKeyboard });
  }
};
