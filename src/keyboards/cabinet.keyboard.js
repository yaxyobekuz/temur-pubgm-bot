import { Keyboard } from "grammy";

export const cabinetKeyboard = new Keyboard()
  .text("🏆 Turnirlar")
  .text("🎟 Bosqich slotini tanlash")
  .row()
  .text("👥 Mening komandam")
  .text("📋 Mening turnirlarim")
  .row()
  .text("👤 Profil")
  .text("ℹ️ Yordam")
  .row()
  .text("⚙️ Sozlamalar")
  .resized();
