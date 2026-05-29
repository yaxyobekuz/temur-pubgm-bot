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

export const fetchMyTeam = (tgId) =>
  api.get("/bot/teams", { params: { tgId } }).then((r) => r.data.data);

export const createTeam = (tgId, body) =>
  api.post("/bot/teams", { tgId, ...body }).then((r) => r.data.data);

export const updateOwnTeam = (tgId, body) =>
  api
    // Logo updates make the server download the image, so give that request a longer timeout.
    .patch("/bot/teams", { tgId, ...body }, body.logoUrl ? { timeout: 60_000 } : undefined)
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

export const registerForTournament = (tgId, id, roster) =>
  api
    .post(`/bot/tournaments/${id}/register`, { tgId, roster })
    .then((r) => r.data.data);

export const listMyRegistrations = (tgId) =>
  api.get("/bot/registrations", { params: { tgId } }).then((r) => r.data.data);

// --- Help links ------------------------------------------------------------

export const fetchHelpLinks = () =>
  api.get("/bot/help-links").then((r) => r.data.data);
