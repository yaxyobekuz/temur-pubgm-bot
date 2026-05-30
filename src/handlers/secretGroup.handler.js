import logger from "../config/logger.js";

const GROUP_TYPES = new Set(["group", "supergroup"]);

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
