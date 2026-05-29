import { settingsKeyboard } from "../keyboards/settings.keyboard.js";
import { cabinetKeyboard } from "../keyboards/cabinet.keyboard.js";
import { buildRegionKeyboard } from "../keyboards/region.keyboard.js";
import { fetchRegions, switchRegion, fetchMe } from "../services/backend.service.js";
import logger from "../config/logger.js";

export const showSettings = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }
  await ctx.reply("⚙️ Sozlamalar:", { reply_markup: settingsKeyboard });
};

export const askRegionSwitch = async (ctx) => {
  const user = ctx.state?.user;
  if (!user) {
    await ctx.reply("Avval ro'yxatdan o'ting: /start");
    return;
  }
  let regions = [];
  try {
    regions = await fetchRegions();
  } catch (err) {
    logger.error({ err: err.message }, "fetchRegions failed");
    await ctx.reply("Mintaqalarni yuklab bo'lmadi.");
    return;
  }
  if (!regions.length) {
    await ctx.reply("Mintaqalar topilmadi.");
    return;
  }
  await ctx.reply(
    `Hozirgi mintaqa: *${user.region?.name || "-"}*\nYangi mintaqani tanlang:`,
    { parse_mode: "Markdown", reply_markup: buildRegionKeyboard(regions, "setregion") },
  );
};

export const handleRegionCallback = async (ctx) => {
  const regionId = ctx.callbackQuery.data.split(":")[1];
  try {
    const updated = await switchRegion(ctx.from.id, regionId);
    ctx.state.user = await fetchMe(ctx.from.id).catch(() => updated);
    await ctx.answerCallbackQuery({ text: "Mintaqa almashtirildi" });
    await ctx.editMessageText(
      `Yangi mintaqa: *${ctx.state.user?.region?.name || "-"}*`,
      { parse_mode: "Markdown" },
    );
    await ctx.reply("Kabinet:", { reply_markup: cabinetKeyboard });
  } catch (err) {
    logger.error({ err: err.message }, "Region switch failed");
    const msg = err?.response?.data?.message || "Mintaqa almashtirishda xato";
    await ctx.answerCallbackQuery({ text: msg, show_alert: true });
  }
};
