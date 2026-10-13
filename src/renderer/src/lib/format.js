export function formatDuration(sec) {
  if (sec === null || sec === undefined) return "";
  // A media element reports NaN duration until metadata loads, and can report
  // a negative currentTime mid-seek — both would render as "NaN:NaN" here.
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatUploadDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "";
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${d}/${m}/${y}`;
}

export function formatShortDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

const MEDIA_URL_RE =
  /https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/\S+|https?:\/\/(www\.)?instagram\.com\/\S+|https?:\/\/(www\.|clips\.)?twitch\.tv\/\S+/g;

export function extractMediaUrls(text) {
  const matches = text.match(MEDIA_URL_RE) || [];
  // Strips trailing punctuation/brackets that aren't part of the URL but get
  // swept up by \S+ when a link is pasted from chat/docs, e.g. "(...)" or a
  // sentence-ending "." — without this the extra chars ride along into the
  // yt-dlp call and the video fails to resolve with a confusing error.
  const cleaned = matches.map((m) => m.replace(/[)\]}>,.;!?"'”’]+$/, ""));
  return [...new Set(cleaned)];
}

// Instagram only offers video here (see ResultCard) — reels/posts are short
// clips where an audio-only extraction isn't a use case worth the extra UI.
export function detectPlatform(url) {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/twitch\.tv/.test(url)) return "twitch";
  return "other";
}
