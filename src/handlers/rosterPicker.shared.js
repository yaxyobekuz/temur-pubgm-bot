import { buildRosterPickerKeyboard } from "../keyboards/tournaments.keyboard.js";

export const MODE_ROSTER_SIZE = { solo: 1, duo: 2, squad: 4 };

export const countMain = (slots) =>
  Object.values(slots).filter((s) => s === "main").length;

// Status text for the roster picker. `heading` differs per flow (register vs VIP placement).
export const buildRosterStatusText = ({ heading, mode, required, slots }) => {
  const main = countMain(slots);
  const reserve = Object.values(slots).filter((s) => s === "reserve").length;
  return [
    heading,
    "",
    `Rejim: <b>${mode}</b> (aynan <b>${required}</b> ta asosiy o'yinchi kerak)`,
    `Tanlangan asosiy: <b>${main}/${required}</b> • Zaxira: <b>${reserve}</b>`,
    "",
    "Har bir a'zoni bosib slotni almashtirib turing.",
    "Belgilar: <b>★</b> asosiy · <b>◌</b> zaxira · <b>·</b> tanlanmagan",
  ].join("\n");
};

// `cb` = { toggle, submit, cancel } callback prefixes for the flow (register vs VIP placement).
export const buildRosterKeyboard = (members, slots, required, cb) => {
  const canSubmit = countMain(slots) === required;
  return buildRosterPickerKeyboard(members, slots, canSubmit, cb);
};

// Cycle a member's slot: none -> main -> reserve -> none. Caps main at `required`.
export const toggleSlot = (slots, userId, required) => {
  const cur = slots[userId];
  if (!cur) slots[userId] = "main";
  else if (cur === "main") slots[userId] = "reserve";
  else delete slots[userId];
  if (slots[userId] === "main" && countMain(slots) > required) {
    slots[userId] = "reserve";
  }
};

// Build the roster array (sorted entries) from the slots map.
export const slotsToRoster = (slots) =>
  Object.entries(slots).map(([user, slot], i) => ({ user, slot, position: i }));
