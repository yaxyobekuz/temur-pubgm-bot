import { InlineKeyboard } from "grammy";

export const roleSwitchKeyboard = new InlineKeyboard()
  .text("Leader (komanda sardori)", "role:leader")
  .row()
  .text("Player (o'yinchi)", "role:player");

// Ro'yxatdan o'tishda rol tanlash (conversation ichida ushlanadi - alohida prefiks).
export const registerRoleKeyboard = new InlineKeyboard()
  .text("👑 Sardor", "regrole:leader")
  .row()
  .text("🎮 O'yinchi", "regrole:player");
