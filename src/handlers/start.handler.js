import { mainKeyboard } from "../keyboards/main.keyboard.js";

const startHandler = async (ctx) => {
  const name = ctx.from?.first_name || "Foydalanuvchi";
  await ctx.reply(
    `Assalomu alaykum, ${name}!\n\nTemur PUBGM botiga xush kelibsiz.`,
    { reply_markup: mainKeyboard },
  );
};

export default startHandler;
