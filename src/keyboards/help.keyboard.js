import { InlineKeyboard } from "grammy";

// One URL button per help link (admin name + url), configured from the panel.
export const buildHelpKeyboard = (links = []) => {
  const kb = new InlineKeyboard();
  for (const l of links) {
    if (l?.url) kb.url(l.name || "Havola", l.url).row();
  }
  return kb;
};
