const AUDIO_FORMATS = new Set(["mp3", "flac", "wav", "aac", "opus", "m4a"]);
const PRESETS = new Set(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]);

function validateExport({ start, end, target, options = {} }) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error("Escolha um início e um fim válidos para o corte.");
  }
  if (!["video", "audio", "gif", "webp"].includes(target) || !options || typeof options !== "object" || Array.isArray(options)) {
    throw new Error("Escolha um formato de exportação válido.");
  }
  for (const [key, value] of Object.entries(options)) {
    if (key === "precise" && typeof value === "boolean") continue;
    if (key === "audioFormat" && (value === null || AUDIO_FORMATS.has(value))) continue;
    if (key === "preset" && PRESETS.has(value)) continue;
    const bounds = { width: [16, 3840], fps: [1, 60], crf: [0, 51], quality: [0, 100] }[key];
    if (bounds && Number.isInteger(value) && value >= bounds[0] && value <= bounds[1]) continue;
    throw new Error("Uma das opções de exportação é inválida.");
  }
}

module.exports = { validateExport };
