import {
  listOpenTournaments,
  getTournamentById,
  listMyRegistrations,
  setTournamentBannerFileId,
  fetchSettings,
  getSelfSponsorChannels,
} from "../services/backend.service.js";
import {
  buildTournamentsListKeyboard,
  buildTournamentDetailKeyboard,
  buildMyRegistrationsKeyboard,
  buildSelfSponsorKeyboard,
} from "../keyboards/tournaments.keyboard.js";
import { fetchAsInputFile } from "../utils/media.js";
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

// Sends just the banner image (no keyboard) with an optional caption. Caches the
// file_id on first upload. No-op (returns false) when the tournament has no banner.
export const sendBannerPhoto = async (ctx, tournament, caption = "") => {
  if (!tournament.bannerFileId && !tournament.banner) return false;
  const opts = caption ? { caption, parse_mode: "HTML" } : {};

  if (tournament.bannerFileId) {
    try {
      await ctx.replyWithPhoto(tournament.bannerFileId, opts);
      return true;
    } catch (err) {
      logger.warn({ err: err.message }, "banner file_id failed, trying stored file");
    }
  }
  try {
    const sent = await ctx.replyWithPhoto(
      await fetchAsInputFile(tournament.banner, "banner.jpg"),
      opts,
    );
    const fileId = sent.photo?.[sent.photo.length - 1]?.file_id;
    if (fileId) {
      setTournamentBannerFileId(tournament._id, fileId).catch((err) =>
        logger.warn({ err: err.message }, "cache banner file_id failed"),
      );
    }
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, "banner photo failed");
    return false;
  }
};

// Sends a tournament with its banner as a photo (caption = card). Caches the
// Telegram file_id on first upload so later sends are instant. Falls back to text.
export const sendTournamentCard = async (ctx, tournament, replyMarkup) => {
  const caption = formatTournamentCard(tournament);
  const opts = { caption, parse_mode: "HTML", reply_markup: replyMarkup };

  if (tournament.bannerFileId) {
    try {
      await ctx.replyWithPhoto(tournament.bannerFileId, opts);
      return;
    } catch (err) {
      logger.warn({ err: err.message }, "tournament banner file_id failed, trying stored file");
    }
  }
  if (tournament.banner) {
    try {
      const sent = await ctx.replyWithPhoto(
        await fetchAsInputFile(tournament.banner, "banner.jpg"),
        opts,
      );
      // Cache the largest photo's file_id for instant resends (best-effort).
      const fileId = sent.photo?.[sent.photo.length - 1]?.file_id;
      if (fileId) {
        setTournamentBannerFileId(tournament._id, fileId).catch((err) =>
          logger.warn({ err: err.message }, "cache banner file_id failed"),
        );
      }
      return;
    } catch (err) {
      logger.warn({ err: err.message }, "tournament banner photo failed, falling back to text");
    }
  }
  await ctx.reply(caption, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
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
    // List'ni qayta ko'rsatish. Oldingi xabar rasm (banner) bo'lishi mumkin -
    // rasmni edit qilib bo'lmaydi, shuning uchun o'chirib yangi xabar yuboramiz.
    try {
      const items = await listOpenTournaments();
      await ctx.deleteMessage().catch(() => {});
      await ctx.reply("Ochiq turnirlar:", {
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
    const [tournament, myRegs, settings] = await Promise.all([
      getTournamentById(id),
      listMyRegistrations(ctx.from.id).catch(() => []),
      fetchSettings().catch(() => ({})),
    ]);
    const alreadyRegistered = myRegs.some(
      (r) =>
        String(r.tournament?._id || r.tournament) === String(tournament._id) &&
        r.status === "registered",
    );
    const canRegister = user?.role === "leader";
    const replyMarkup = buildTournamentDetailKeyboard(tournament, {
      canRegister,
      alreadyRegistered,
      vipAdminUrl: settings?.vipAdminUrl,
    });

    // List xabarini almashtirib, banner bilan turnir kartasini yuboramiz.
    await ctx.deleteMessage().catch(() => {});
    await sendTournamentCard(ctx, tournament, replyMarkup);
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
      const isVip = r.nextPlacementKind === "vip";
      lines.push(
        isVip
          ? "   🎟 VIP slot - joy tanlang: 🎟 Bosqich slotini tanlash"
          : "   ⚠️ Keyingi bosqich uchun joy tanlang: 🎟 Bosqich slotini tanlash",
      );
    }
    if (r.tournament?.startDate) {
      lines.push(`   ${formatDate(r.tournament.startDate)}`);
    }
  }
  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    reply_markup: buildMyRegistrationsKeyboard(items),
  });
};

// sponsorinfo:<tournamentId> - "Mening turnirlarim"dan homiy-kanal xabarini olish/tekshirish.
export const handleSponsorInfo = async (ctx) => {
  const tournamentId = ctx.callbackQuery.data.split(":")[1];
  let data;
  try {
    data = await getSelfSponsorChannels(ctx.from.id, tournamentId);
  } catch (err) {
    logger.warn({ err: err.message }, "self sponsor check failed");
    await ctx.answerCallbackQuery({
      text: "Tekshirib bo'lmadi. Keyinroq urinib ko'ring.",
      show_alert: true,
    });
    return;
  }

  if (data.ok) {
    await ctx.answerCallbackQuery({
      text: "✅ Siz barcha homiy kanallarga obuna bo'lgansiz",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  const text = `❗ <b>${data.tournamentTitle}</b> turniri homiy kanal(lar)iga obuna bo'ling:\n\n⚠️ Diqqat! Homiy kanallardan chiqib ketsangiz, siz va jamoangiz turnirdan chetlatilishingiz mumkin.`;
  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: buildSelfSponsorKeyboard(data.channels, tournamentId),
  });
};
