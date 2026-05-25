import { InlineKeyboard } from "grammy";

export const buildRegionKeyboard = (regions = []) => {
  const kb = new InlineKeyboard();
  regions.forEach((r, i) => {
    kb.text(r.name, `region:${r._id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  return kb;
};
