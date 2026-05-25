import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { acceptInvite, fetchMe } from "../services/backend.service.js";
import { REGISTER_CONVERSATION } from "./register.handler.js";
import logger from "../config/logger.js";

const startHandler = async (ctx) => {
  // Drop any in-flight conversation so a fresh /start doesn't stack handlers
  // (otherwise each old conversation answers with "Iltimos, mintaqani tanlang").
  await ctx.conversation.exit();

  const payload = ctx.match || "";
  const isTeamDeepLink = typeof payload === "string" && payload.startsWith("team_");

  const user = ctx.state?.user;

  if (!user) {
    if (isTeamDeepLink) {
      // Stash the invite code so the registration flow can apply it after sign-up.
      ctx.session ||= {};
      ctx.session.pendingInvite = payload;
      await ctx.reply(
        "Komandaga qo'shilish uchun avval ro'yxatdan o'tasiz.",
      );
    } else {
      await ctx.reply(
        `Assalomu alaykum, ${ctx.from?.first_name || "Foydalanuvchi"}!\nTemur PUBGM botiga xush kelibsiz.`,
      );
    }
    await ctx.conversation.enter(REGISTER_CONVERSATION);
    return;
  }

  if (isTeamDeepLink) {
    try {
      const team = await acceptInvite(ctx.from.id, payload);
      ctx.state.user = await fetchMe(ctx.from.id).catch(() => user);
      await ctx.reply(
        `Siz "${team.name}" komandasiga qo'shildingiz!`,
        { reply_markup: cabinetKeyboard },
      );
    } catch (err) {
      logger.warn({ err: err.message }, "acceptInvite failed");
      const msg = err?.response?.data?.message || "Taklifni qabul qilib bo'lmadi";
      await ctx.reply(msg, { reply_markup: cabinetKeyboard });
    }
    return;
  }

  await ctx.reply(
    `Xush kelibsiz, ${user.firstName}!`,
    { reply_markup: cabinetKeyboard },
  );
};

export default startHandler;
