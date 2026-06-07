import logger from "../config/logger.js";
import { fetchSecretGroupTeams } from "../services/backend.service.js";

const GROUP_TYPES = new Set(["group", "supergroup"]);

// HTML parse_mode uchun jamoa nomi/username'dagi maxsus belgilarni xavfsizlaydi.
const escapeHtml = (s = "") =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// /id - in a group, replies with the chat_id so the admin can paste it into the panel
// as the tournament's secret-group chatId. Requires the bot to be an admin there.
export const handleIdCommand = async (ctx) => {
  const chat = ctx.chat;
  if (!chat) return;

  if (!GROUP_TYPES.has(chat.type)) {
    await ctx.reply("Bu buyruq faqat guruh ichida ishlaydi.");
    return;
  }

  try {
    const me = await ctx.api.getChatMember(chat.id, ctx.me.id);
    const isAdmin = me.status === "administrator" || me.status === "creator";
    if (!isAdmin) {
      await ctx.reply(
        "Avval meni guruhga admin qiling, so'ng /id buyrug'ini qayta yuboring.",
      );
      return;
    }
    await ctx.reply(
      `🆔 Guruh Chat ID:\n<code>${chat.id}</code>\n\nShu raqamni admin panelda "Maxfiy guruh" bo'limiga kiriting.`,
      { parse_mode: "HTML" },
    );
  } catch (err) {
    logger.warn({ err: err.message, chatId: chat.id }, "/id failed");
    await ctx.reply("Chat ID'ni aniqlab bo'lmadi. Bot guruhda adminmi?");
  }
};

// /teams - maxfiy guruh ichida, shu guruhga joylashgan barcha jamoalarni slot bilan ko'rsatadi.
// Format: "<slot> - <jamoa nomi> @<aloqa username>". Slot lobbida 3-dan boshlanadi (1-2 band).
export const handleTeamsCommand = async (ctx) => {
  const chat = ctx.chat;
  if (!chat) return;

  if (!GROUP_TYPES.has(chat.type)) {
    await ctx.reply("Bu buyruq faqat guruh ichida ishlaydi.");
    return;
  }

  let data;
  try {
    data = await fetchSecretGroupTeams(chat.id);
  } catch (err) {
    if (err?.response?.status === 404) {
      await ctx.reply(
        "Bu guruh hech qaysi turnir guruhiga maxfiy guruh sifatida ulanmagan.",
      );
      return;
    }
    logger.warn({ err: err.message, chatId: chat.id }, "/teams failed");
    await ctx.reply("Jamoalar ro'yxatini olishda xato. Keyinroq urinib ko'ring.");
    return;
  }

  if (!data.teams?.length) {
    await ctx.reply("Bu guruhga hali birorta jamoa ro'yxatdan o'tmagan.");
    return;
  }

  const lines = data.teams.map((t) => {
    const handle = t.username ? `@${escapeHtml(t.username)}` : "—";
    const name = t.tag ? `[${escapeHtml(t.tag)}] ${escapeHtml(t.name)}` : escapeHtml(t.name);
    return `${t.slot} - ${name} ${handle}`;
  });
  await ctx.reply(
    `📋 <b>Ro'yxatdan o'tgan jamoalar</b> (${data.teams.length})\n\n${lines.join("\n")}`,
    { parse_mode: "HTML" },
  );
};
