import { Bot } from "grammy";
import { run } from "@grammyjs/runner";

import { env } from "./config/env.js";
import logger from "./config/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import startHandler from "./handlers/start.handler.js";
import helpHandler from "./handlers/help.handler.js";

const bot = new Bot(env.BOT_TOKEN);

bot.command("start", startHandler);
bot.command("help", helpHandler);

bot.hears("Yordam", helpHandler);
bot.hears("Profil", async (ctx) => {
  await ctx.reply("Profil tez orada qo'shiladi.");
});

bot.catch(errorHandler);

const start = async () => {
  await bot.init();
  logger.info(`Bot @${bot.botInfo.username} ishga tushdi`);
  run(bot);
};

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

start().catch((err) => {
  logger.error({ err }, "Botni ishga tushirishda xato");
  process.exit(1);
});
