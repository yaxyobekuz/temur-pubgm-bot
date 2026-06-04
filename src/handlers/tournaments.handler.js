import {
  listOpenTournaments,
  getTournamentById,
  listMyRegistrations,
} from "../services/backend.service.js";
import {
  buildTournamentsListKeyboard,
  buildTournamentDetailKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import logger from "../config/logger.js";

const MODE_LABELS = { solo: "Solo (1)", duo: "Duo (2)", squad: "Squad (4)" };
const STATUS_LABELS = {
  registered: "Ro'yxatda",
  kicked: "Chiqarildi",
  dq: "Diskvalifikatsiya",
};

const formatDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("uz-UZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MONTHS_UZ = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

// "21-may, 2026" - schedule day label.
const formatDateOnly = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()}-${MONTHS_UZ[d.getMonth()]}, ${d.getFullYear()}`;
};

const formatTournamentCard = (t) => {
  const lines = [
    `🏆 <b>${t.title}</b>`,
    "",
    `Rejim: <b>${MODE_LABELS[t.mode] || t.mode}</b>`,
    `Boshlanish: ${formatDate(t.startDate)}`,
    t.prizePool ? `Mukofot: <b>${t.prizePool}</b>` : null,
    t.maxTeams ? `Maks. komandalar: ${t.maxTeams}` : null,
  ].filter(Boolean);

  if (t.description) lines.push("", t.description);

  if (t.maps?.length) {
    lines.push("", `Xaritalar: ${t.maps.join(", ")}`);
  }

  // Homiy kanallar bu yerda ko'rsatilmaydi - "Ro'yxatdan o'tish" bosilganda chiqadi.
  return lines.join("\n");
};

export const showOpenTournaments = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }
  let items = [];
  try {
    items = await listOpenTournaments();
  } catch (err) {
    logger.error({ err: err.message }, "listOpenTournaments failed");
    await ctx.reply("Turnirlarni yuklab bo'lmadi.");
    return;
  }
  if (!items.length) {
    await ctx.reply("Hozircha ochiq turnirlar yo'q.");
    return;
  }
  await ctx.reply("Ochiq turnirlar:", {
    reply_markup: buildTournamentsListKeyboard(items),
  });
};

export const handleTournamentDetail = async (ctx) => {
  const id = ctx.callbackQuery.data.split(":")[1];
  if (id === "back") {
    await ctx.answerCallbackQuery();
    // List'ni qayta ko'rsatish - eski xabarni edit qilamiz.
    try {
      const items = await listOpenTournaments();
      await ctx.editMessageText("Ochiq turnirlar:", {
        reply_markup: buildTournamentsListKeyboard(items),
      });
    } catch (err) {
      logger.warn({ err: err.message }, "back to list failed");
    }
    return;
  }

  await ctx.answerCallbackQuery();
  const user = ctx.state?.user;
  try {
    const [tournament, myRegs] = await Promise.all([
      getTournamentById(id),
      listMyRegistrations(ctx.from.id).catch(() => []),
    ]);
    const alreadyRegistered = myRegs.some(
      (r) =>
        String(r.tournament?._id || r.tournament) === String(tournament._id) &&
        r.status === "registered",
    );
    const canRegister = user?.role === "leader";

    await ctx.editMessageText(formatTournamentCard(tournament), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: buildTournamentDetailKeyboard(tournament, {
        canRegister,
        alreadyRegistered,
      }),
    });
  } catch (err) {
    logger.warn({ err: err.message, id }, "tournament detail failed");
    const msg = err?.response?.data?.message || "Turnirni yuklab bo'lmadi";
    await ctx.reply(msg);
  }
};

// "noop" callback - placeholder tugmalar uchun (faqat acknowledge).
export const handleNoopCallback = async (ctx) => {
  await ctx.answerCallbackQuery();
};

export const showMyRegistrations = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }
  let items = [];
  try {
    items = await listMyRegistrations(ctx.from.id);
  } catch (err) {
    logger.error({ err: err.message }, "listMyRegistrations failed");
    await ctx.reply("Yuklab bo'lmadi.");
    return;
  }
  if (!items.length) {
    await ctx.reply("Sizning komandangiz hech qaysi turnirda ro'yxatdan o'tmagan.");
    return;
  }
  const lines = ["📋 <b>Mening turnirlarim</b>", ""];
  for (const r of items) {
    const tName = r.tournament?.title || "Turnir";
    const status = STATUS_LABELS[r.status] || r.status;
    lines.push(`• <b>${tName}</b> - ${status}`);
    if (r.currentGroup?.code) {
      const g = r.currentGroup;
      const dayLabel = g.date ? formatDateOnly(g.date) : g.day ? `${g.day}-kun` : null;
      const timeLabel = g.time || (g.timeSlot ? `${g.timeSlot}-vaqt` : null);
      const slot = [dayLabel, timeLabel].filter(Boolean).join(", ");
      lines.push(`   Guruh ${g.code}${slot ? ` · ${slot}` : ""}`);
    }
    // Advanced/VIP but not yet placed into the next stage.
    if ((r.eligibleStage || 1) > (r.placedStage || 0)) {
      lines.push("   ⚠️ Keyingi bosqich uchun joy tanlang: 🎟 Bosqich slotini tanlash");
    }
    if (r.tournament?.startDate) {
      lines.push(`   ${formatDate(r.tournament.startDate)}`);
    }
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
};
