import { InlineKeyboard } from "grammy";

export const roleSwitchKeyboard = new InlineKeyboard()
  .text("Leader (komanda sardori)", "role:leader")
  .row()
  .text("Player (o'yinchi)", "role:player");
