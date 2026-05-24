import "dotenv/config";

const required = ["BOT_TOKEN"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

export const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || "development",
  BOT_TOKEN: process.env.BOT_TOKEN,
  API_BASE_URL: process.env.API_BASE_URL || "http://localhost:5000/api",
});
