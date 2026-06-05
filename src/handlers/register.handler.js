import { Keyboard } from "grammy";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { contactKeyboard } from "../keyboards/contact.keyboard.js";
import { buildRegionKeyboard } from "../keyboards/region.keyboard.js";
import { registerRoleKeyboard } from "../keyboards/role.keyboard.js";
import {
  fetchRegions,
  registerOrLogin,
  fetchMe,
} from "../services/backend.service.js";
import { showOpenTournaments } from "./tournaments.handler.js";
import { sendUsageGuide } from "./guide.handler.js";
import logger from "../config/logger.js";

const ROLE_LABEL = { leader: "Komanda sardori", player: "O'yinchi" };

// Multi-step registration conversation.
// Step 1: pick role (sardor / o'yinchi).
// Step 2: pick region from inline keyboard.
// Step 3: share Telegram contact (phone is verified by Telegram itself).
export const registerConversation = async (conversation, ctx) => {
  // Step 1: rol tanlash.
  await ctx.reply(
    [
      "Siz botdan kim sifatida foydalanmoqchisiz?",
      "",
      "👑 <b>Sardor</b> - jamoa sardori va menejeri.",
      "🎮 <b>O'yinchi</b> - jamoa a'zosi va oddiy o'yinchi.",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: registerRoleKeyboard },
  );

  const roleCb = await conversation.waitForCallbackQuery(/^regrole:/, {
    otherwise: (innerCtx) => innerCtx.reply("Iltimos, yuqoridagi tugmadan rolni tanlang."),
  });
  const role = roleCb.callbackQuery.data.split(":")[1];
  await roleCb.answerCallbackQuery();
  await ctx.reply(`Tanlangan rol: ${ROLE_LABEL[role] || role}`);

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
        role,
      }),
    );
    await ctx.reply(
      `Xush kelibsiz, ${user.firstName}!\nRolingiz: ${ROLE_LABEL[user.role] || user.role}. Kabinetga o'tdik.`,
      { reply_markup: cabinetKeyboard },
    );

    // Ro'yxat tugadi (oxirgi wait'dan keyin - bir marta bajariladi). State'ni yangilab,
    // mavjud turnirlar ro'yxati va botdan foydalanish qo'llanmasini yuboramiz.
    ctx.state ||= {};
    ctx.state.user = await conversation.external(() =>
      fetchMe(ctx.from.id).catch(() => user),
    );
    await showOpenTournaments(ctx);
    await sendUsageGuide(ctx);
  } catch (err) {
    logger.error({ err: err.message }, "register-or-login failed");
    // Serverdan kelgan aniq sababni ko'rsatamiz (masalan telefon/mintaqa xatosi).
    const msg = err?.response?.data?.message || "Ro'yxatdan o'tishda xato. Keyinroq urinib ko'ring.";
    await ctx.reply(msg, { reply_markup: new Keyboard().resized() });
  }
};

export const REGISTER_CONVERSATION = "registerConversation";
