import { Keyboard } from "grammy";

export const cabinetKeyboard = new Keyboard()
  .text("🏆 Turnirlar")
  .row()
  .text("👥 Mening komandam")
  .text("📋 Mening turnirlarim")
  .row()
  .text("👤 Profil")
  .text("ℹ️ Yordam")
  .row()
  .text("⚙️ Sozlamalar")
  .resized();
