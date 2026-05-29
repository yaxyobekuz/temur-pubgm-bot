import { Keyboard } from "grammy";

export const cabinetKeyboard = new Keyboard()
  .text("👤 Profil")
  .text("⚙️ Sozlamalar")
  .row()
  .text("👥 Mening komandam")
  .text("🏆 Turnirlar")
  .row()
  .text("📋 Mening turnirlarim")
  .text("ℹ️ Yordam")
  .resized();
