import "dotenv/config";

const required = ["BOT_TOKEN", "BOT_SHARED_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || "development",
  BOT_TOKEN: process.env.BOT_TOKEN,
  API_BASE_URL: process.env.API_BASE_URL || "http://localhost:5000/api",
  BOT_SHARED_SECRET: process.env.BOT_SHARED_SECRET,
  BOT_HTTP_HOST: process.env.BOT_HTTP_HOST || "127.0.0.1",
  BOT_HTTP_PORT: Number(process.env.BOT_HTTP_PORT || 5300),
});
