import { Keyboard } from "grammy";

export const settingsKeyboard = new Keyboard()
  .text("🔁 Rolni almashtirish")
  .row()
  .text("🌍 Mintaqani almashtirish")
  .row()
  .text("⬅️ Kabinet")
  .resized();
