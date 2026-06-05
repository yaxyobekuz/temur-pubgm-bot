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

// Qo'llanma matnini yuboradi.
export const sendUsageGuide = async (ctx) => {
  await ctx.reply(USAGE_GUIDE, { parse_mode: "HTML", disable_web_page_preview: true });
};
