// Telegram HTML parse_mode uchun foydalanuvchi kiritgan matndagi maxsus
// belgilarni (&, <, >) xavfsizlaydi. Aks holda ism/komanda nomidagi belgilar
// "can't parse entities" xatosini keltirib chiqaradi.
export const escapeHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default escapeHtml;
