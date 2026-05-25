import { fetchMe } from "../services/backend.service.js";
import logger from "../config/logger.js";

// Resolves the backend user by tgId and stashes it on ctx.state.user.
// Unknown users get `null` - handlers can then prompt registration.
export const authContext = async (ctx, next) => {
  const tgId = ctx.from?.id;
  if (!tgId) return next();
  try {
    ctx.state ||= {};
    ctx.state.user = await fetchMe(tgId);
  } catch (err) {
    if (err?.response?.status === 404) {
      ctx.state ||= {};
      ctx.state.user = null;
    } else {
      logger.warn({ err: err.message, tgId }, "authContext fetch failed");
      ctx.state ||= {};
      ctx.state.user = null;
    }
  }
  await next();
};
