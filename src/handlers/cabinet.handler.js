import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { escapeHtml } from "../utils/escapeHtml.js";

const ROLE_LABEL = { leader: "Komanda sardori", player: "O'yinchi" };

export const showCabinet = async (ctx, message = "Kabinet:") => {
  await ctx.reply(message, { reply_markup: cabinetKeyboard });
};

export const profileHandler = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }
  const region = user.region?.name || "-";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const lines = [
    `👤 <b>Profil</b>`,
    `Ism: ${escapeHtml(fullName)}`,
    `Rol: ${escapeHtml(ROLE_LABEL[user.role] || user.role)}`,
    `Mintaqa: ${escapeHtml(region)}`,
    `Telefon: ${escapeHtml(user.contactPhone || "-")}`,
  ];
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
};

export default showCabinet;
