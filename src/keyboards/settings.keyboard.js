import { Keyboard } from "grammy";

export const settingsKeyboard = new Keyboard()
  .text("🔁 Rolni almashtirish")
  .row()
  .text("🌍 Mintaqani almashtirish")
  .row()
  .text("🔗 Aloqa username")
  .row()
  .text("⬅️ Kabinet")
  .resized();
