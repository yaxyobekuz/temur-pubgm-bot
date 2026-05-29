import { fetchHelpLinks } from "../services/backend.service.js";
import { buildHelpKeyboard } from "../keyboards/help.keyboard.js";
import logger from "../config/logger.js";

const helpHandler = async (ctx) => {
  let links = [];
  try {
    links = await fetchHelpLinks();
  } catch (err) {
    logger.warn({ err: err.message }, "fetchHelpLinks failed");
  }

  const text = links.length
    ? "Savollaringiz bo'lsa, quyidagi adminlarga murojaat qiling:"
    : "Yordam uchun keyinroq urinib ko'ring yoki /start buyrug'ini ishlating.";

  await ctx.reply(text, {
    reply_markup: links.length ? buildHelpKeyboard(links) : undefined,
  });
};

export default helpHandler;
