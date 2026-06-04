import { InlineKeyboard } from "grammy";

const MODE_LABELS = { solo: "Solo", duo: "Duo", squad: "Squad" };

export const buildTournamentsListKeyboard = (tournaments = []) => {
  const kb = new InlineKeyboard();
  for (const t of tournaments) {
    const label = `${t.title} • ${MODE_LABELS[t.mode] || t.mode}`;
    kb.text(label, `tour:${t._id}`).row();
  }
  return kb;
};

// `canRegister` true bo'lsa "Ro'yxatdan o'tish" tugmasi qo'shiladi (faqat leader uchun).
export const buildTournamentDetailKeyboard = (tournament, { canRegister, alreadyRegistered }) => {
  const kb = new InlineKeyboard();
  if (alreadyRegistered) {
    kb.text("✅ Ro'yxatdasiz", "noop");
  } else if (canRegister) {
    kb.text("📝 Ro'yxatdan o'tish", `register:${tournament._id}`);
  } else {
    kb.text("ℹ️ Faqat leader ro'yxatdan o'tkazadi", "noop");
  }
  kb.row().text("⬅️ Orqaga", "tour:back");
  return kb;
};

const slotLabel = (slot) => {
  if (slot === "main") return "★";
  if (slot === "reserve") return "◌";
  return "·";
};

// Roster picker - har a'zoga 3 ta toggle tugma: Asosiy, Zaxira, Yo'q
export const buildRosterPickerKeyboard = (members = [], slots = {}, canSubmit = false) => {
  const kb = new InlineKeyboard();
  for (const m of members) {
    const slot = slots[String(m._id)] || null;
    const name =
      [m.firstName, m.lastName].filter(Boolean).join(" ") || m.tgUsername || "O'yinchi";
    kb.text(`${slotLabel(slot)} ${name}`, `slot:${m._id}`).row();
  }
  if (canSubmit) {
    kb.text("✅ Yuborish", "roster:submit");
  }
  kb.text("❌ Bekor qilish", "roster:cancel");
  return kb;
};

// Sponsor channel rejection - har bir kanal uchun URL tugma + qayta tekshirish tugmasi.
// "subcheck" statik - tournamentId/day/timeSlot sessiyadan o'qiladi (callback-data limiti uchun).
export const buildSponsorChannelsKeyboard = (channels = []) => {
  const kb = new InlineKeyboard();
  for (const c of channels) {
    kb.url(c.title || "Kanal", c.url).row();
  }
  kb.text("🔄 Tekshirish", "subcheck");
  return kb;
};

// Secret group rejection - single URL button to join the private group.
export const buildSecretGroupKeyboard = (group) => {
  const kb = new InlineKeyboard();
  if (group?.url) kb.url(group.title || "Maxfiy guruh", group.url);
  return kb;
};

// Cascading slot selection step 1: pick a day that still has free spots.
// openSlots = { days: [{ day, label, timeSlots: [...] }] }. `p` is the callback prefix
// ("slot" for registration, "place" for advanced/VIP placement).
export const buildDayPickerKeyboard = (openSlots = {}, p = "slot") => {
  const kb = new InlineKeyboard();
  for (const d of openSlots.days || []) {
    kb.text(d.label || `${d.day}-kun`, `${p}day:${d.day}`).row();
  }
  kb.text("❌ Bekor qilish", `${p}cancel`);
  return kb;
};

// Cascading slot selection step 2: pick a time slot within the chosen day.
// Uses the concrete time label from the server (`t.label`/`t.time`), with a numbered fallback.
export const buildTimePickerKeyboard = (day, openSlots = {}, p = "slot") => {
  const kb = new InlineKeyboard();
  const dayEntry = (openSlots.days || []).find((d) => d.day === day);
  for (const t of dayEntry?.timeSlots || []) {
    const label = t.label || t.time || `${t.timeSlot}-vaqt`;
    kb.text(`${label} (${t.freeSpots})`, `${p}time:${day}:${t.timeSlot}`).row();
  }
  kb.text("⬅️ Orqaga", `${p}back`).row();
  kb.text("❌ Bekor qilish", `${p}cancel`);
  return kb;
};
