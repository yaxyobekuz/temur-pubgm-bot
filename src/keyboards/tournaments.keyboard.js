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
// `vipAdminUrl` bo'lsa "VIP slot olish" havola tugmasi ko'rinadi (admin bilan bog'lanish).
export const buildTournamentDetailKeyboard = (
  tournament,
  { canRegister, alreadyRegistered, vipAdminUrl } = {},
) => {
  const kb = new InlineKeyboard();
  if (alreadyRegistered) {
    kb.text("✅ Ro'yxatdasiz", "noop");
  } else if (canRegister) {
    kb.text("📝 Ro'yxatdan o'tish", `register:${tournament._id}`);
  } else {
    kb.text("ℹ️ Faqat leader ro'yxatdan o'tkazadi", "noop");
  }
  if (vipAdminUrl) {
    kb.row().url("🎟 VIP slot olish", vipAdminUrl);
  }
  kb.row().text("⬅️ Orqaga", "tour:back");
  return kb;
};

const slotLabel = (slot) => {
  if (slot === "main") return "★";
  if (slot === "reserve") return "◌";
  return "·";
};

// Roster picker - har a'zoga 3 ta toggle tugma: Asosiy, Zaxira, Yo'q.
// `cb` callback prefikslari: register oqimi uchun default, VIP placement uchun "placeslot"/...
export const buildRosterPickerKeyboard = (
  members = [],
  slots = {},
  canSubmit = false,
  cb = { toggle: "slot", submit: "roster:submit", cancel: "roster:cancel" },
) => {
  const kb = new InlineKeyboard();
  for (const m of members) {
    const slot = slots[String(m._id)] || null;
    const name =
      [m.firstName, m.lastName].filter(Boolean).join(" ") || m.tgUsername || "O'yinchi";
    kb.text(`${slotLabel(slot)} ${name}`, `${cb.toggle}:${m._id}`).row();
  }
  if (canSubmit) {
    kb.text("✅ Yuborish", cb.submit);
  }
  kb.text("❌ Bekor qilish", cb.cancel);
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

// Secret group rejection - a URL button to join the private group, plus an optional
// "qayta urinish" callback button so the leader can retry the same action right after joining
// (without re-picking roster/day/time). `retryCb` is a static callback string.
export const buildSecretGroupKeyboard = (group, retryCb) => {
  const kb = new InlineKeyboard();
  if (group?.url) kb.url(group.title || "Maxfiy guruh", group.url);
  if (retryCb) kb.row().text("🔄 Tekshirish / Qayta urinish", retryCb);
  return kb;
};

// "Mening turnirlarim" ostidagi tugmalar: har aktiv turnir uchun homiy-kanal eslatmasini olish.
const ACTIVE_TOURNAMENT_STATUSES = ["pending", "ongoing"];
export const buildMyRegistrationsKeyboard = (registrations = []) => {
  const kb = new InlineKeyboard();
  let has = false;
  for (const r of registrations) {
    const t = r.tournament;
    if (r.status !== "registered") continue;
    if (!ACTIVE_TOURNAMENT_STATUSES.includes(t?.status)) continue;
    kb.text(`🔔 ${t.title} - homiy kanallar`, `sponsorinfo:${t._id}`).row();
    has = true;
  }
  return has ? kb : undefined;
};

// "Mening turnirlarim" homiy-kanal xabari: kanal havolalari + o'zini qayta tekshirish tugmasi.
export const buildSelfSponsorKeyboard = (channels = [], tournamentId) => {
  const kb = new InlineKeyboard();
  for (const c of channels) kb.url(c.title || "Kanal", c.url).row();
  kb.text("🔄 Tekshirish", `sponsorinfo:${tournamentId}`);
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
    kb.text(label, `${p}time:${day}:${t.timeSlot}`).row();
  }
  kb.text("⬅️ Orqaga", `${p}back`).row();
  kb.text("❌ Bekor qilish", `${p}cancel`);
  return kb;
};
