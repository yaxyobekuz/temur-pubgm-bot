import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";

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
  const lines = [
    `👤 *Profil*`,
    `Ism: ${user.firstName} ${user.lastName || ""}`.trim(),
    `Rol: ${ROLE_LABEL[user.role] || user.role}`,
    `Mintaqa: ${region}`,
    `Telefon: ${user.contactPhone || "-"}`,
  ];
  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
};

export default showCabinet;
