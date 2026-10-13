const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const logDir = () => {
  const dir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const logFilePath = () => path.join(logDir(), "aurora.log");

const MAX_BYTES = 5 * 1024 * 1024; // 5MB, then rotate once
const SECRET_KEY = /token|cookie|password|secret|authorization|api.?key|headers?|args|payload|url/i;
const URL_IN_TEXT = /https?:\/\/[^\s"']+/gi;
const SENSITIVE_IN_TEXT = /\b(?:bearer\s+\S+|(?:authorization|cookie|token|api[_-]?key|password)\s*[:=]\s*\S+|ytsearch1:\S+)/gi;

function redact(value, key = "", depth = 0) {
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return value.replace(URL_IN_TEXT, "[url]").replace(SENSITIVE_IN_TEXT, "[redacted]").slice(0, 2000);
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redact(item, "", depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([name, item]) => [name, redact(item, name, depth + 1)]));
  }
  return value;
}

function rotateIfNeeded() {
  try {
    const file = logFilePath();
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) {
      const old = path.join(logDir(), "aurora.old.log");
      fs.rmSync(old, { force: true });
      fs.renameSync(file, old);
    }
  } catch {
    /* best-effort */
  }
}

function write(level, scope, message, meta) {
  const line = {
    ts: new Date().toISOString(),
    level,
    scope,
    message: redact(message),
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
  };
  const text = JSON.stringify(line);
  try {
    rotateIfNeeded();
    fs.appendFileSync(logFilePath(), text + "\n", "utf8");
  } catch {
    /* if disk logging fails, still surface to console below */
  }
  const consoleFn = level === "error" || level === "critical" ? console.error : level === "warn" ? console.warn : console.log;
  try {
    consoleFn(`[${line.ts}] [${level.toUpperCase()}] [${scope}] ${line.message}`, line.meta ?? "");
  } catch {
    // A GUI process can outlive the launching shell; its stdio pipe then closes.
  }
}

module.exports = {
  info: (scope, message, meta) => write("info", scope, message, meta),
  warn: (scope, message, meta) => write("warn", scope, message, meta),
  error: (scope, message, meta) => write("error", scope, message, meta),
  debug: (scope, message, meta) => write("debug", scope, message, meta),
  critical: (scope, message, meta) => write("critical", scope, message, meta),
  logFilePath,
  logDir,
};
