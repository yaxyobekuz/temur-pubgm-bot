import { roleSwitchKeyboard } from "../keyboards/role.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { switchRole, fetchMe } from "../services/backend.service.js";
import logger from "../config/logger.js";

const ROLE_LABEL = { leader: "Komanda sardori", player: "O'yinchi" };

export const askRoleSwitch = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }
  if (!["leader", "player"].includes(user.role)) {
    await ctx.reply("Sizning rolingiz almashtirib bo'lmaydi.");
    return;
  }
  await ctx.reply(
    `Hozirgi rol: *${ROLE_LABEL[user.role] || user.role}*\nQaysi rolga o'tasiz?`,
    { parse_mode: "Markdown", reply_markup: roleSwitchKeyboard },
  );
};

export const handleRoleCallback = async (ctx) => {
  const next = ctx.callbackQuery.data.split(":")[1];
  if (!["leader", "player"].includes(next)) {
    await ctx.answerCallbackQuery({ text: "Noma'lum rol" });
    return;
  }
  try {
    const updated = await switchRole(ctx.from.id, next);
    ctx.state.user = await fetchMe(ctx.from.id).catch(() => updated);
    await ctx.answerCallbackQuery({ text: "Rol almashtirildi" });
    await ctx.editMessageText(
      `Yangi rol: *${ROLE_LABEL[next] || next}*`,
      { parse_mode: "Markdown" },
    );
    await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
  } catch (err) {
    logger.error({ err: err.message }, "Role switch failed");
    const msg = err?.response?.data?.message || "Rol almashtirishda xato";
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
  }
};
