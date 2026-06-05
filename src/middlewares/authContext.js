import { fetchMe } from "../services/backend.service.js";
import logger from "../config/logger.js";

// Resolves the backend user by tgId and stashes it on ctx.state.user.
// Unknown users get `null` - handlers can then prompt registration.
export const authContext = async (ctx, next) => {
  const tgId = ctx.from?.id;
  if (!tgId) return next();
  ctx.state ||= {};
  ctx.state.user = null;
  ctx.state.userError = false;
  try {
    ctx.state.user = await fetchMe(tgId);
  } catch (err) {
    // 404 = haqiqatan ro'yxatdan o'tmagan (registratsiya kerak).
    // Boshqa xato (server o'chiq/tarmoq/500) = userError - mavjud foydalanuvchini
    // registratsiyaga majburlamaslik uchun handlerlar buni tekshiradi.
    if (err?.response?.status !== 404) {
      logger.warn({ err: err.message, tgId }, "authContext fetch failed");
      ctx.state.userError = true;
    }
  }
  await next();
};
