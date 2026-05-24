import logger from "../config/logger.js";

export const errorHandler = (err) => {
  const ctx = err.ctx;
  logger.error(
    { update_id: ctx?.update?.update_id, error: err.error?.message || err.message },
    "Bot error",
  );
};
