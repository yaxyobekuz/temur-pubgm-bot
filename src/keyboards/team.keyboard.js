import { Keyboard } from "grammy";

export const leaderTeamKeyboard = new Keyboard()
  .text("📛 Komanda nomini o'zgartirish")
  .row()
  .text("🔗 Taklif havolasi")
  .text("♻️ Kodni yangilash")
  .row()
  .text("👥 A'zolarni boshqarish")
  .row()
  .text("⬅️ Kabinet")
  .resized();

export const playerTeamKeyboard = new Keyboard()
  .text("🚪 Komandadan chiqish")
  .row()
  .text("⬅️ Kabinet")
  .resized();

export const noTeamLeaderKeyboard = new Keyboard()
  .text("➕ Yangi komanda yaratish")
  .row()
  .text("⬅️ Kabinet")
  .resized();
