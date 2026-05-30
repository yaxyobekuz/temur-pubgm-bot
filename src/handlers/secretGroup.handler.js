import { resolveSecretGroup } from "../services/backend.service.js";
import logger from "../config/logger.js";

const GROUP_TYPES = new Set(["group", "supergroup"]);
const ADMIN_STATUSES = new Set(["administrator", "member", "creator"]);

const inviteHashFrom = (url) => {
  const m = (url || "").match(/t\.me\/(?:\+|joinchat\/)([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
};

// When the bot is added to a private group (as admin/member), capture its chat_id
// and match it to the tournament whose secret-group invite link hash matches.
export const handleMyChatMember = async (ctx) => {
  const upd = ctx.myChatMember;
  const chat = ctx.chat;
  if (!upd || !chat || !GROUP_TYPES.has(chat.type)) return;

  const status = upd.new_chat_member?.status;
  if (!ADMIN_STATUSES.has(status)) return; // bot left/kicked - ignore

  try {
    // Prefer the invite link from the update; else read the chat's primary invite link.
    let inviteHash = inviteHashFrom(upd.invite_link?.invite_link);
    if (!inviteHash) {
      const full = await ctx.api.getChat(chat.id).catch(() => null);
      inviteHash = inviteHashFrom(full?.invite_link);
    }
    // inviteHash topilmasa ham yuboramiz - server guruhni chatId bo'yicha keshlaydi,
    // havola keyin turnirga yozilganda moslashtirish ishlashi uchun.
    const res = await resolveSecretGroup({
      inviteHash: inviteHash || "",
      chatId: chat.id,
      title: chat.title || "",
    });
    logger.info(
      { chatId: chat.id, hasHash: !!inviteHash, matched: !!res?.matched },
      "secret group resolve attempt",
    );
  } catch (err) {
    logger.warn({ err: err.message, chatId: chat.id }, "secret group resolve failed");
  }
};
