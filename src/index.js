import { Bot, session } from "grammy";
import { run } from "@grammyjs/runner";
import { conversations, createConversation } from "@grammyjs/conversations";

import { env } from "./config/env.js";
import logger from "./config/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authContext } from "./middlewares/authContext.js";
import { startBotInternalServer } from "./server/botInternal.server.js";

import startHandler from "./handlers/start.handler.js";
import helpHandler from "./handlers/help.handler.js";
import {
  registerConversation,
  REGISTER_CONVERSATION,
} from "./handlers/register.handler.js";
import { profileHandler, showCabinet } from "./handlers/cabinet.handler.js";
import {
  askRoleSwitch,
  handleRoleCallback,
} from "./handlers/roleSwitch.handler.js";
import {
  showSettings,
  askRegionSwitch,
  handleRegionCallback,
} from "./handlers/settings.handler.js";
import {
  showTeam,
  startCreateTeam,
  startRenameTeam,
  startSetLogo,
  startKickMember,
  handleKickCallback,
  handleRegenerateInvite,
  handleShowInvite,
  handleLeaveTeam,
  handlePendingTextInput,
  handleTeamPhoto,
} from "./handlers/team.handler.js";
import {
  showOpenTournaments,
  handleTournamentDetail,
  handleNoopCallback,
  showMyRegistrations,
} from "./handlers/tournaments.handler.js";
import {
  handleStartRegister,
  handleSlotToggle,
  handleRosterCancel,
  handleRosterSubmit,
} from "./handlers/registerTournament.handler.js";
import { handleMyChatMember } from "./handlers/secretGroup.handler.js";

const bot = new Bot(env.BOT_TOKEN);

bot.use(
  session({
    initial: () => ({
      await: null,
      pendingInvite: null,
      roster: null,
    }),
  }),
);
bot.use(conversations());
bot.use(createConversation(registerConversation, REGISTER_CONVERSATION));
bot.use(authContext);

// Bot added/removed in a group (admin) - auto-capture secret group chat_id.
bot.on("my_chat_member", handleMyChatMember);

// Pending free-text inputs (team name, rename) - runs before generic handlers.
bot.on("message:text", handlePendingTextInput);
// Team logo: only consumes the photo while awaiting "team:logo", else passes through.
bot.on("message:photo", handleTeamPhoto);

bot.command("start", startHandler);
bot.command("help", helpHandler);

// Cabinet menu
bot.hears("👤 Profil", profileHandler);
bot.hears("⚙️ Sozlamalar", showSettings);
bot.hears("👥 Mening komandam", showTeam);
bot.hears("🏆 Turnirlar", showOpenTournaments);
bot.hears("📋 Mening turnirlarim", showMyRegistrations);
bot.hears("ℹ️ Yordam", helpHandler);

// Settings submenu
bot.hears("🔁 Rolni almashtirish", askRoleSwitch);
bot.hears("🌍 Mintaqani almashtirish", askRegionSwitch);

// Team submenu
bot.hears("📛 Komanda nomini o'zgartirish", startRenameTeam);
bot.hears("🖼 Logotip", startSetLogo);
bot.hears("🔗 Taklif havolasi", handleShowInvite);
bot.hears("♻️ Havolani yangilash", handleRegenerateInvite);
bot.hears("👥 A'zolarni boshqarish", startKickMember);
bot.hears("🚪 Komandadan chiqish", handleLeaveTeam);
bot.hears("➕ Yangi komanda yaratish", startCreateTeam);
bot.hears("⬅️ Kabinet", (ctx) => showCabinet(ctx));

// Inline callbacks
bot.callbackQuery(/^role:/, handleRoleCallback);
bot.callbackQuery(/^setregion:/, handleRegionCallback);
bot.callbackQuery(/^kick:/, handleKickCallback);
bot.callbackQuery(/^tour:/, handleTournamentDetail);
bot.callbackQuery(/^register:/, handleStartRegister);
bot.callbackQuery(/^slot:/, handleSlotToggle);
bot.callbackQuery("roster:cancel", handleRosterCancel);
bot.callbackQuery("roster:submit", handleRosterSubmit);
bot.callbackQuery("noop", handleNoopCallback);

bot.catch(errorHandler);

const start = async () => {
  await bot.init();
  logger.info(`Bot @${bot.botInfo.username} ishga tushdi`);
  await startBotInternalServer(bot);
  // my_chat_member/chat_member are NOT delivered by default - opt in explicitly.
  run(bot, {
    runner: {
      fetch: {
        allowed_updates: [
          "message",
          "callback_query",
          "my_chat_member",
          "chat_member",
        ],
      },
    },
  });
};

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

start().catch((err) => {
  logger.error({ err }, "Botni ishga tushirishda xato");
  process.exit(1);
});
