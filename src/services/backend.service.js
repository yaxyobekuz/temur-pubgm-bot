import api from "./api.service.js";

// Public, no secret needed. Used for the region picker on /start.
export const fetchRegions = () =>
  api.get("/public/regions").then((r) => r.data.data);

export const registerOrLogin = (payload) =>
  api.post("/bot/auth/register-or-login", payload).then((r) => r.data.data);

export const fetchMe = (tgId) =>
  api.get("/bot/users/me", { params: { tgId } }).then((r) => r.data.data);

export const switchRole = (tgId, newRole) =>
  api.post("/bot/users/role", { tgId, newRole }).then((r) => r.data.data);

export const switchRegion = (tgId, regionId) =>
  api.post("/bot/users/region", { tgId, regionId }).then((r) => r.data.data);

export const updateContactUsername = (tgId, contactUsername) =>
  api
    .patch("/bot/users/contact-username", { tgId, contactUsername })
    .then((r) => r.data.data);

export const fetchMyTeam = (tgId) =>
  api.get("/bot/teams", { params: { tgId } }).then((r) => r.data.data);

export const createTeam = (tgId, body) =>
  api.post("/bot/teams", { tgId, ...body }).then((r) => r.data.data);

export const updateOwnTeam = (tgId, body) =>
  api
    // Logo updates make the server download the image, so give that request a longer timeout.
    .patch("/bot/teams", { tgId, ...body }, body.logoUrl ? { timeout: 180_000 } : undefined)
    .then((r) => r.data.data);

export const regenerateInvite = (tgId) =>
  api.post("/bot/teams/regenerate-invite", { tgId }).then((r) => r.data.data);

export const kickMember = (tgId, memberId) =>
  api.post("/bot/teams/kick", { tgId, memberId }).then((r) => r.data.data);

export const leaveTeam = (tgId) =>
  api.post("/bot/teams/leave", { tgId }).then((r) => r.data);

export const acceptInvite = (tgId, inviteCode) =>
  api.post("/bot/teams/accept-invite", { tgId, inviteCode }).then((r) => r.data.data);

// --- Tournaments -----------------------------------------------------------

export const listOpenTournaments = () =>
  api.get("/bot/tournaments").then((r) => r.data.data);

export const getTournamentById = (id) =>
  api.get(`/bot/tournaments/${id}`).then((r) => r.data.data);

// Cache the Telegram file_id after the first banner upload (best-effort).
export const setTournamentBannerFileId = (id, fileId) =>
  api.patch(`/bot/tournaments/${id}/banner-file-id`, { fileId }).then((r) => r.data.data);

export const fetchOpenSlots = (id) =>
  api.get(`/bot/tournaments/${id}/open-slots`).then((r) => r.data.data);

// Komandaning homiy kanal obunasini erta tekshiradi (roster tanlashdan oldin).
export const checkSponsorMembership = (tgId, id) =>
  api
    .get(`/bot/tournaments/${id}/sponsor-check`, { params: { tgId } })
    .then((r) => r.data.data);

// Foydalanuvchining ushbu turnir uchun obuna bo'lmagan homiy kanallari ("Mening turnirlarim").
export const getSelfSponsorChannels = (tgId, id) =>
  api
    .get(`/bot/tournaments/${id}/sponsor-self`, { params: { tgId } })
    .then((r) => r.data.data);

// /start: yetkazilmagan homiy-kanal eslatmalarini qayta yuborishni so'raydi (best-effort).
export const resendSponsorReminders = (tgId) =>
  api.post("/bot/users/sponsor-reminders/resend", { tgId }).then((r) => r.data.data);

// /start: yetkazilmagan VIP slot xabarini qayta yuboradi. { resent } qaytadi - true bo'lsa
// bot joy tanlash oynasini avtomatik ochadi.
export const resendPlacementNotice = (tgId) =>
  api.post("/bot/users/placement-notice/resend", { tgId }).then((r) => r.data.data);

export const registerForTournament = (tgId, id, roster, day, timeSlot) =>
  api
    .post(`/bot/tournaments/${id}/register`, { tgId, roster, day, timeSlot })
    .then((r) => r.data.data);

export const listMyRegistrations = (tgId) =>
  api.get("/bot/registrations", { params: { tgId } }).then((r) => r.data.data);

// Team advanced/VIP-invited to a stage but not yet placed: returns the pending placement + slots.
export const fetchPendingPlacement = (tgId) =>
  api.get("/bot/registrations/pending-placement", { params: { tgId } }).then((r) => r.data.data);

export const placeIntoStage = (tgId, registrationId, day, timeSlot, roster) =>
  api
    .post(`/bot/registrations/${registrationId}/place`, { tgId, day, timeSlot, roster })
    .then((r) => r.data.data);

// --- Secret group ----------------------------------------------------------

// Maxfiy guruh chatId orqali shu guruhga joylashgan jamoalar (slot bilan).
export const fetchSecretGroupTeams = (chatId) =>
  api
    .get("/bot/groups/teams-by-chat", { params: { chatId } })
    .then((r) => r.data.data);

// --- Help links ------------------------------------------------------------

export const fetchHelpLinks = () =>
  api.get("/bot/help-links").then((r) => r.data.data);

// --- Settings --------------------------------------------------------------

export const fetchSettings = () =>
  api.get("/bot/settings").then((r) => r.data.data);
