// crypto.randomUUID exists in both Node 16.7+ (desktop/Electron's main
// process) and modern Chromium WebViews (mobile/Capacitor) — a single check
// covers both, and avoids a static `require("crypto")` that bundlers like
// esbuild choke on when this module is bundled for the browser.
function randomId() {
  if (typeof crypto === "undefined" || !crypto.randomUUID) {
    throw new Error("crypto.randomUUID is not available in this environment.");
  }
  return crypto.randomUUID();
}

// Builds a fresh queue job object in the "aguardando" state. Pure factory —
// no side effects, no fs, no id persisted anywhere by this function itself.
function createJob({ url, title, uploader, thumbnail, mode, resolution, audioFormat, outputDir }) {
  const id = randomId();
  return {
    id,
    url,
    title: title || url,
    uploader: uploader || null,
    thumbnail: thumbnail || null,
    mode, // "video" | "audio"
    resolution: resolution || null,
    audioFormat: audioFormat || "mp3",
    outputDir,
    status: "aguardando",
    progress: 0,
    speed: "",
    eta: "",
    sizeText: "",
    error: null,
    filePath: null,
  };
}

module.exports = { createJob };
