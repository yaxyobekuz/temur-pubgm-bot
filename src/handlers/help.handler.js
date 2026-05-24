const helpHandler = async (ctx) => {
  await ctx.reply(
    [
      "Mavjud buyruqlar:",
      "/start - Botni qayta ishga tushirish",
      "/help - Yordam",
    ].join("\n"),
  );
};

export default helpHandler;
