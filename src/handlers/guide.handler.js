import { env } from "../config/env.js";
import logger from "../config/logger.js";

// Botdan foydalanish bo'yicha qisqa qo'llanma. Ro'yxatdan o'tgach yuboriladi.
export const USAGE_GUIDE = [
  "📖 <b>Botdan qanday foydalanish</b>",
  "",
  "🏆 <b>Turnirga ro'yxatdan o'tish</b>",
  "“🏆 Turnirlar” → turnirni tanlang → “📝 Ro'yxatdan o'tish”. Faqat <b>sardor</b> jamoani ro'yxatdan o'tkazadi.",
  "",
  "👥 <b>Komandani sozlash</b> (sardor uchun)",
  "“👥 Mening komandam” → komanda yarating, nom/logotip qo'ying va taklif havolasi orqali a'zolarni qo'shing.",
  "",
  "🔁 <b>Rolni almashtirish</b>",
  "“⚙️ Sozlamalar” → “🔁 Rolni almashtirish” (Sardor ↔ O'yinchi).",
  "",
  "📋 <b>Turnirlaringiz va guruh/vaqtni ko'rish</b>",
  "“📋 Mening turnirlarim”. Keyingi bosqichga o'tsangiz - “🎟 Bosqich slotini tanlash”.",
  "",
  "👤 “👤 Profil” - ma'lumotlaringiz · ℹ️ “Yordam” - admin bilan aloqa.",
].join("\n");

// Qo'llanma matnini yuboradi (videosi bo'lmasa yoki yuborib bo'lmasa - fallback).
const sendUsageGuideText = (ctx) =>
  ctx.reply(USAGE_GUIDE, { parse_mode: "HTML", disable_web_page_preview: true });

// Qo'llanmani yuboradi: agar file_id sozlangan bo'lsa - qo'llanma videosi (caption = matn),
// aks holda matnli qo'llanma. Video yuborishda xato bo'lsa, matnga qaytadi.
export const sendUsageGuide = async (ctx) => {
  const fileId = env.GUIDE_VIDEO_FILE_ID;
  if (!fileId) {
    await sendUsageGuideText(ctx);
    return;
  }
  try {
    await ctx.replyWithVideo(fileId, { caption: USAGE_GUIDE, parse_mode: "HTML" });
  } catch (err) {
    logger.error({ err: err.message }, "guide video send failed; falling back to text");
    await sendUsageGuideText(ctx);
  }
};
