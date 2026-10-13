const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { protocol } = require("electron");
const log = require("./logger");
const { loadLibrary } = require("./libraryStore");

// Playback used to point the <audio>/<video> element straight at a file:// URL.
// That works for plain playback, but Chromium gives every file:// resource its
// own opaque origin, so feeding such an element into a WebAudio AnalyserNode
// (what the mini player's spectrum needs) yields a *tainted* source — which
// outputs silence, not just empty analysis data. Serving the same bytes over an
// app-owned, CORS-enabled scheme makes the media a clean, same-app resource that
// WebAudio is allowed to read.
const SCHEME = "aurora-media";
const HOST = "local";

const MIME_BY_EXT = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".opus": "audio/ogg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/webm",
};

// Must run before app "ready" — Electron only accepts privilege declarations
// while the protocol registry is still open.
function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

// The whole path travels as a single encoded segment, so drive letters and the
// backslashes, spaces and unicode that yt-dlp leaves in filenames survive the
// round-trip without being reinterpreted as URL structure.
function toMediaUrl(filePath) {
  return `${SCHEME}://${HOST}/${encodeURIComponent(filePath)}`;
}

function fromMediaUrl(url) {
  const { pathname, protocol: scheme, hostname, username, password } = new URL(url);
  if (scheme !== `${SCHEME}:` || hostname !== HOST || username || password) throw new Error("Endereço de mídia inválido.");
  return decodeURIComponent(pathname.replace(/^\//, ""));
}

function isLibraryMediaPath(filePath) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) return false;
  const normalized = path.normalize(filePath);
  return loadLibrary().some((item) => !item.removed && typeof item.filePath === "string" && path.normalize(item.filePath) === normalized);
}

// "bytes=start-end", either end optional. Returns null for absent//unsatisfiable
// headers so the caller falls back to a plain 200 with the whole file.
function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  // A suffix range ("bytes=-500") asks for the *last* N bytes.
  let start = rawStart === "" ? size - Number(rawEnd) : Number(rawStart);
  let end = rawStart === "" || rawEnd === "" ? size - 1 : Number(rawEnd);
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
  return { start, end };
}

function registerProtocolHandler() {
  protocol.handle(SCHEME, async (request) => {
    if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405 });
    let filePath;
    try {
      filePath = path.normalize(fromMediaUrl(request.url));
    } catch (e) {
      log.error("media", "URL de mídia inválida", { url: request.url, message: e.message });
      return new Response("Bad request", { status: 400 });
    }
    if (!isLibraryMediaPath(filePath)) return new Response("Forbidden", { status: 403 });

    let stat;
    try {
      stat = await fs.promises.stat(filePath);
    } catch {
      // Routine rather than exceptional: the library can hold entries whose
      // file the user deleted from disk behind the app's back.
      log.warn("media", "arquivo de mídia não encontrado", { filePath });
      return new Response("Not found", { status: 404 });
    }
    if (!stat.isFile()) return new Response("Not found", { status: 404 });

    const contentType = MIME_BY_EXT[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    // Seeking in a long track only works if partial requests are honoured —
    // without Accept-Ranges/206 the element has to refetch from byte 0.
    const headers = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    };

    const range = parseRange(request.headers.get("Range"), stat.size);
    if (request.headers.has("Range") && !range) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${stat.size}` } });
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: { ...headers, "Content-Length": String(stat.size) } });
    if (!range) {
      const stream = fs.createReadStream(filePath);
      return new Response(Readable.toWeb(stream), {
        status: 200,
        headers: { ...headers, "Content-Length": String(stat.size) },
      });
    }

    const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(range.end - range.start + 1),
        "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
      },
    });
  });
}

module.exports = { SCHEME, registerScheme, registerProtocolHandler, toMediaUrl, isLibraryMediaPath };
