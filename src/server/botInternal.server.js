import express from "express";
import crypto from "node:crypto";
import { InputFile } from "grammy";
import { env } from "../config/env.js";
import logger from "../config/logger.js";

// API_BASE_URL "http://host:5000/api" → "http://host:5000". Static fayllar `/api` ostida emas.
const SERVER_ORIGIN = env.API_BASE_URL.replace(/\/api\/?$/, "");

// Telegram sendPhoto tashqi URL'lardan o'qiy oladi, lekin localhost ko'rinmaydi.
// Shu sabab nisbiy `/uploads/...` yo'lni bot serverdan stream qilib oladi va InputFile sifatida yuboradi.
const fetchMediaAsInputFile = async (mediaUrl) => {
  const isAbsolute = /^https?:\/\//i.test(mediaUrl);
  const url = isAbsolute ? mediaUrl : `${SERVER_ORIGIN}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`media fetch failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const name = url.split("/").pop()?.split("?")[0] || "photo";
  return new InputFile(buf, name);
};

const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
};

const secretGate = (req, res, next) => {
  if (!safeEqual(req.headers["x-bot-secret"], env.BOT_SHARED_SECRET)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

// Build an inline keyboard from { text, url } buttons (broadcasts use this).
// Har bir tugma alohida qatorda (homiy kanallar bir qatorga tiqilmasligi uchun).
const buildKeyboard = (buttons) => {
  if (!Array.isArray(buttons) || !buttons.length) return undefined;
  return {
    inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]),
  };
};

export const createBotInternalServer = (bot) => {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(secretGate);

  // Membership check for sponsor channels.
  // Body: { tgIds: [number], chatIds: [string] }
  // Returns: { [tgId]: { [chatId]: boolean } }
  app.post("/check-membership", async (req, res) => {
    const { tgIds = [], chatIds = [] } = req.body || {};
    const result = {};

    for (const tgId of tgIds) {
      result[tgId] = {};
      for (const chatId of chatIds) {
        try {
          const m = await bot.api.getChatMember(chatId, Number(tgId));
          result[tgId][chatId] = !["left", "kicked"].includes(m.status);
        } catch (err) {
          // Treat any error (no admin rights, wrong id, user blocked) as "not a member".
          logger.warn(
            { err: err.message, tgId, chatId },
            "getChatMember failed",
          );
          result[tgId][chatId] = false;
        }
      }
    }
    res.json({ success: true, data: result });
  });

  // Send a single message to a chat. Used by the broadcast Agenda job per recipient.
  // Body: { chatId: number|string, text: string, parseMode?: 'Markdown'|'HTML',
  //         buttons?: [{text,url}], mediaUrl?: string }
  app.post("/send-message", async (req, res) => {
    const { chatId, text, parseMode, buttons, mediaUrl } = req.body || {};
    if (!chatId || (!text && !mediaUrl)) {
      return res.status(400).json({ success: false, message: "chatId va text/mediaUrl kerak" });
    }
    const opts = {
      reply_markup: buildKeyboard(buttons),
      parse_mode: parseMode,
    };

    try {
      let messageId;
      if (mediaUrl) {
        const photo = await fetchMediaAsInputFile(mediaUrl);
        const sent = await bot.api.sendPhoto(chatId, photo, {
          caption: text || undefined,
          ...opts,
        });
        messageId = sent.message_id;
      } else {
        const sent = await bot.api.sendMessage(chatId, text, opts);
        messageId = sent.message_id;
      }
      res.json({ success: true, data: { messageId } });
    } catch (err) {
      logger.warn({ err: err.message, chatId, mediaUrl }, "send-message failed");
      res
        .status(502)
        .json({ success: false, message: err.message || "Send failed" });
    }
  });

  return app;
};

export const startBotInternalServer = (bot) => {
  const app = createBotInternalServer(bot);
  return new Promise((resolve) => {
    const server = app.listen(env.BOT_HTTP_PORT, env.BOT_HTTP_HOST, () => {
      logger.info(
        `Internal HTTP ${env.BOT_HTTP_HOST}:${env.BOT_HTTP_PORT} da ishlamoqda`,
      );
      resolve(server);
    });
  });
};
