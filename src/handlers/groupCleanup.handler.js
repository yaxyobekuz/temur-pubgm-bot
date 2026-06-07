import logger from "../config/logger.js";

const GROUP_TYPES = new Set(["group", "supergroup"]);

// Deletes Telegram's "X joined the group" / "Y left the group" service messages to keep
// group chats clean. Requires the bot to be an admin with the "Delete messages" right;
// if it lacks the permission (or the message is too old) the delete fails and is ignored.
export const cleanupJoinLeaveMessages = async (ctx) => {
  const chat = ctx.chat;
  if (!chat || !GROUP_TYPES.has(chat.type)) return;
  try {
    await ctx.deleteMessage();
  } catch (err) {
    logger.warn(
      { err: err.message, chatId: chat.id },
      "join/leave service message cleanup failed (bot admin with delete rights?)",
    );
  }
};
