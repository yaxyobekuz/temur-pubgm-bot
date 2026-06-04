import { InputFile } from "grammy";
import { env } from "../config/env.js";

// API_BASE_URL "http://host:5000/api" → "http://host:5000". Static fayllar `/api` ostida emas.
const SERVER_ORIGIN = env.API_BASE_URL.replace(/\/api\/?$/, "");

export const toAbsolute = (url) =>
  /^https?:\/\//i.test(url) ? url : `${SERVER_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;

// Telegram can't fetch localhost; the bot downloads the image and sends it as a buffer.
export const fetchAsInputFile = async (url, fallbackName = "image.jpg") => {
  const abs = toAbsolute(url);
  const resp = await fetch(abs);
  if (!resp.ok) throw new Error(`image fetch failed: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const name = abs.split("/").pop()?.split("?")[0] || fallbackName;
  return new InputFile(buf, name);
};
