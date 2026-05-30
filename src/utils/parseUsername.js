// Foydalanuvchi kiritgan turli ko'rinishlardan toza Telegram username chiqaradi:
// "@temur", "temur", "t.me/temur", "https://t.me/temur", "telegram.me/temur".
// Mos kelmasa null qaytaradi.
export const parseUsername = (raw) => {
  if (raw == null) return null;
  let value = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return null;

  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^(t\.me|telegram\.me)\//, "");
  value = value.replace(/^@/, "");
  value = value.replace(/[/?].*$/, ""); // oxiridagi "/" yoki "?..." qismni olib tashlash

  return /^[a-z0-9_]{5,32}$/.test(value) ? value : null;
};

export default parseUsername;
