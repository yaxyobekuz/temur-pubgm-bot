import { Keyboard } from "grammy";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { contactKeyboard } from "../keyboards/contact.keyboard.js";
import { buildRegionKeyboard } from "../keyboards/region.keyboard.js";
import {
  fetchRegions,
  registerOrLogin,
} from "../services/backend.service.js";
import logger from "../config/logger.js";

// Multi-step registration conversation.
// Step 1: pick region from inline keyboard.
// Step 2: share Telegram contact (phone is verified by Telegram itself).
export const registerConversation = async (conversation, ctx) => {
  let regions = [];
  try {
    regions = await conversation.external(() => fetchRegions());
  } catch (err) {
    logger.error({ err: err.message }, "Cannot load regions");
    await ctx.reply("Mintaqalarni yuklab bo'lmadi. Keyinroq urinib ko'ring.");
    return;
  }
  if (!regions.length) {
    await ctx.reply("Mintaqalar topilmadi. Admin bilan bog'laning.");
    return;
  }

  await ctx.reply("Mintaqangizni tanlang:", {
    reply_markup: buildRegionKeyboard(regions),
  });

  const regionCb = await conversation.waitForCallbackQuery(/^region:/, {
    otherwise: (innerCtx) =>
      innerCtx.reply("Iltimos, ro'yxatdan mintaqani tanlang."),
  });
  const regionId = regionCb.callbackQuery.data.split(":")[1];
  await regionCb.answerCallbackQuery();

  await ctx.reply(
    "Telefon raqamingizni yuboring:",
    { reply_markup: contactKeyboard },
  );

  const contactCtx = await conversation.waitFor("message:contact", {
    otherwise: (innerCtx) =>
      innerCtx.reply("Iltimos, pastdagi tugma orqali telefon yuboring."),
  });
  const contact = contactCtx.message.contact;

  // Telegram only sets contact.user_id when the user sends THEIR OWN contact;
  // reject anything else to prevent registering another person's number.
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply("Bu sizning raqamingiz emas. Iltimos, o'zingiznikini yuboring.", {
      reply_markup: contactKeyboard,
    });
    return;
  }

  try {
    const user = await conversation.external(() =>
      registerOrLogin({
        tgId: ctx.from.id,
        tgUsername: ctx.from.username || "",
        firstName: ctx.from.first_name || contact.first_name || "Foydalanuvchi",
        lastName: ctx.from.last_name || contact.last_name || "",
        contactPhone: contact.phone_number,
        regionId,
      }),
    );
    await ctx.reply(
      `Xush kelibsiz, ${user.firstName}!\nRolingiz: ${user.role}. Kabinetga o'tdik.`,
      { reply_markup: cabinetKeyboard },
    );
  } catch (err) {
    logger.error({ err: err.message }, "register-or-login failed");
    await ctx.reply("Ro'yxatdan o'tishda xato. Keyinroq urinib ko'ring.", {
      reply_markup: new Keyboard().resized(),
    });
  }
};

export const REGISTER_CONVERSATION = "registerConversation";
