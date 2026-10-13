const path = require("path");

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|0(?:\.\d{1,3}){3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}|::1)$/i;
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function validateMediaUrl(input) {
  if (typeof input !== "string" || !input.trim() || input.length > 4096 || /[\u0000-\u001f\u007f]/.test(input)) {
    throw new Error("Informe um link HTTP ou HTTPS válido.");
  }
  const value = input.trim();
  if (!/^https?:\/\//i.test(value)) throw new Error("Apenas links HTTP e HTTPS são aceitos.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("O link está malformado.");
  }
  const host = parsed.hostname.replace(/\.$/, "");
  const reservedIp = /^(?:192\.0\.(?:0|2)\.|198\.(?:1[89]\.|51\.100\.)|203\.0\.113\.|(?:22[4-9]|23\d|24\d|25[0-5])\.)/.test(host);
  if (!host.includes(".") || parsed.username || parsed.password || PRIVATE_HOST.test(host) || reservedIp || parsed.hostname.startsWith("[")) {
    throw new Error("O endereço do link não é permitido.");
  }
  return parsed.href;
}

function validateMetadataInput(input) {
  if (typeof input === "string" && input.startsWith("ytsearch1:")) {
    const query = input.slice(10).trim();
    if (!query || query.length > 200 || /[\u0000-\u001f\u007f]/.test(query) || /\b[a-z][a-z\d+.-]*:/i.test(query)) {
      throw new Error("A busca é inválida.");
    }
    return `ytsearch1:${query}`;
  }
  return validateMediaUrl(input);
}

function safeThumbnailUrl(input) {
  try {
    const url = validateMediaUrl(input);
    return url.startsWith("https:") ? url : null;
  } catch {
    return null;
  }
}

function safeFileName(value, fallback = "Playlist") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 70)
    .replace(/[. ]+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return RESERVED_NAME.test(cleaned) ? `_${cleaned}` : cleaned;
}

function playlistOutputDir(base, title) {
  if (typeof base !== "string" || !path.isAbsolute(base)) throw new Error("Pasta de download inválida.");
  return path.join(base, safeFileName(title));
}

module.exports = { validateMediaUrl, validateMetadataInput, safeThumbnailUrl, safeFileName, playlistOutputDir };
