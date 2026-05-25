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

// Roster picker — har a'zoga 3 ta toggle tugma: Asosiy, Zaxira, Yo'q
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

// Sponsor channel rejection — har bir kanal uchun URL tugma.
export const buildSponsorChannelsKeyboard = (channels = []) => {
  const kb = new InlineKeyboard();
  for (const c of channels) {
    kb.url(c.title || "Kanal", c.url).row();
  }
  return kb;
};
