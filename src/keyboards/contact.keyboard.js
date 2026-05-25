import { Keyboard } from "grammy";

// Forces Telegram's "share contact" button - phone is verified by Telegram itself.
export const contactKeyboard = new Keyboard()
  .requestContact("📱 Telefon raqamni yuborish")
  .resized()
  .oneTime();
