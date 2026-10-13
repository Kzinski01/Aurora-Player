import aurora from "./aurora.js";

// Forwards renderer-side logs to the main-process log file (src/main/logger.js)
// so bugs reported in the UI are traceable in aurora.log, not just lost in devtools.
function send(level, message, meta) {
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[${level}] ${message}`, meta ?? "");
  aurora.log(level, message, meta).catch(() => {});
}

const logger = {
  info: (message, meta) => send("info", message, meta),
  warn: (message, meta) => send("warn", message, meta),
  error: (message, meta) => send("error", message, meta),
};

export default logger;
