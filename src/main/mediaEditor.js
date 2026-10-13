const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ensureFfmpeg, ensureFfprobe } = require("./binaries");
const log = require("./logger");
const { buildClipArgs, clipOutputName } = require("aurora-core");
const { validateExport } = require("./exportValidation");

// Trimming and format conversion for files already in the library. Everything
// here runs through the ffmpeg that already ships with the app for audio
// conversion — no new dependency, nothing downloaded at runtime.
//
// Exports are deliberately *not* routed through the download queue: a queue job
// is defined by a URL and a yt-dlp invocation, and widening that schema to also
// mean "an ffmpeg run over a local file" would buy shared plumbing at the cost
// of a job type that is half-empty in either direction.

const running = new Map(); // exportId -> child process

let nextId = 1;
const newId = () => `clip-${nextId++}`;

// ---------------------------------------------------------------- probing

// What the editor needs to know before it can draw a timeline: how long the
// file is, and whether it even has a video track (the library holds both).
function probe(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      reject(new Error("Arquivo não encontrado."));
      return;
    }
    const proc = spawn(
      ensureFfprobe(),
      ["-v", "error", "-protocol_whitelist", "file,pipe", "-print_format", "json", "-show_format", "-show_streams", filePath],
      { windowsHide: true }
    );

    let out = "";
    let err = "";
    const timeout = setTimeout(() => { proc.kill(); reject(new Error("O arquivo demorou demais para responder.")); }, 30000);
    proc.stdout.on("data", (d) => {
      out += d.toString();
      if (out.length > 4 * 1024 * 1024) { proc.kill(); reject(new Error("As informações do arquivo ultrapassam o limite permitido.")); }
    });
    proc.stderr.on("data", (d) => (err = (err + d.toString()).slice(-8000)));
    proc.once("error", () => clearTimeout(timeout));
    proc.once("close", () => clearTimeout(timeout));
    proc.on("error", (e) => reject(new Error(`Falha ao inspecionar o arquivo: ${e.message}`)));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err.trim() || "Não foi possível ler as informações do arquivo."));
        return;
      }
      try {
        const data = JSON.parse(out);
        const video = (data.streams || []).find((s) => s.codec_type === "video");
        const audio = (data.streams || []).find((s) => s.codec_type === "audio");
        resolve({
          duration: Number(data.format?.duration) || 0,
          sizeBytes: Number(data.format?.size) || 0,
          hasVideo: Boolean(video),
          hasAudio: Boolean(audio),
          width: video ? Number(video.width) || 0 : 0,
          height: video ? Number(video.height) || 0 : 0,
          videoCodec: video?.codec_name ?? null,
          audioCodec: audio?.codec_name ?? null,
        });
      } catch (e) {
        reject(new Error(`Não foi possível interpretar as informações do arquivo: ${e.message}`));
      }
    });
  });
}

// ---------------------------------------------------------------- output paths

// "video.mp4" + gif -> "video (corte).gif", bumping a counter rather than
// overwriting: a second export of the same clip is nearly always a retry with
// different settings, and silently replacing the first one loses work.
function resolveOutputPath(sourcePath, outputDir, extension) {
  const dir = outputDir || path.dirname(sourcePath);
  fs.mkdirSync(dir, { recursive: true });

  const base = clipOutputName(path.basename(sourcePath, path.extname(sourcePath)));
  let candidate = path.join(dir, `${base}.${extension}`);
  let counter = 2;
  for (;;) {
    try {
      fs.closeSync(fs.openSync(candidate, "wx"));
      return candidate;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      candidate = path.join(dir, `${base} (${counter++}).${extension}`);
    }
  }
}

// ---------------------------------------------------------------- running ffmpeg

// ffmpeg's -progress stream reports elapsed output time in microseconds. Turning
// that into a fraction needs the clip's duration, not the source's.
function parseProgress(chunk, clipSeconds) {
  const match = /out_time_us=(\d+)/.exec(chunk) || /out_time_ms=(\d+)/.exec(chunk);
  if (!match || clipSeconds <= 0) return null;
  // out_time_ms is misnamed in ffmpeg: it is microseconds, same as out_time_us.
  const seconds = Number(match[1]) / 1_000_000;
  return Math.max(0, Math.min(1, seconds / clipSeconds));
}

function runFfmpeg({ args, clipSeconds, exportId, onProgress, progressFrom = 0, progressTo = 1 }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ensureFfmpeg(), args, { windowsHide: true });
    running.set(exportId, proc);

    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      const fraction = parseProgress(chunk.toString(), clipSeconds);
      if (fraction !== null && onProgress) {
        onProgress(progressFrom + fraction * (progressTo - progressFrom));
      }
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      // ffmpeg is chatty; only the tail matters when reporting a failure.
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    proc.on("error", (e) => {
      running.delete(exportId);
      reject(new Error(`Falha ao iniciar o ffmpeg: ${e.message}`));
    });
    proc.on("close", (code, signal) => {
      running.delete(exportId);
      if (signal || code === 255) {
        reject(Object.assign(new Error("Exportação cancelada."), { canceled: true }));
        return;
      }
      if (code !== 0) {
        log.error("editor", "ffmpeg terminou com erro", { exportId, code, args, stderr: stderr.slice(-1200) });
        reject(new Error(friendlyFfmpegError(stderr)));
        return;
      }
      resolve();
    });
  });
}

// ffmpeg's own errors are written for people who already know ffmpeg. These are
// the ones a user can actually act on; anything else falls through unchanged so
// the real message still reaches the log and the toast.
function friendlyFfmpegError(stderr) {
  if (/No space left on device/i.test(stderr)) return "Espaço em disco insuficiente para gerar o arquivo.";
  if (/Permission denied/i.test(stderr)) return "Sem permissão para gravar na pasta de destino.";
  if (/Invalid data found/i.test(stderr)) return "O arquivo de origem parece corrompido ou incompleto.";
  if (/Output file is empty/i.test(stderr)) return "O trecho selecionado é curto demais para gerar um arquivo.";
  const lastLine = stderr.trim().split(/\r?\n/).filter(Boolean).pop();
  return lastLine || "O ffmpeg falhou ao processar o arquivo.";
}

// ---------------------------------------------------------------- exporting

function assertExportable(filePath, clipSeconds) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error("Arquivo de origem não encontrado.");
  if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) {
    throw new Error("Selecione um trecho com início antes do fim.");
  }
}

// Palette generation reads the clip once before encoding reads it again, so the
// two passes split the progress bar between them rather than each running it
// from zero. The palette is a temp file beside the output and goes away however
// this ends.
const PALETTE_PROGRESS_SHARE = 0.3;

async function runPalettedGif({ passes, sourcePath, outputPath, clipSeconds, exportId, onProgress }) {
  const palettePath = `${outputPath}.palette.png`;
  const [buildPalette, encodeWithPalette] = passes;
  try {
    await runFfmpeg({
      args: buildPalette(sourcePath, palettePath),
      clipSeconds,
      exportId,
      onProgress,
      progressFrom: 0,
      progressTo: PALETTE_PROGRESS_SHARE,
    });
    await runFfmpeg({
      args: encodeWithPalette(sourcePath, outputPath, palettePath),
      clipSeconds,
      exportId,
      onProgress,
      progressFrom: PALETTE_PROGRESS_SHARE,
      progressTo: 1,
    });
  } finally {
    fs.rmSync(palettePath, { force: true });
  }
}

/**
 * Trims `filePath` between `start` and `end` (seconds) and writes the result.
 *
 * `target` selects both the pipeline and the container:
 *   "video" — trim, keeping it a video
 *   "audio" — trim, keeping/converting audio only
 *   "gif" / "webp" — animated export of the selected range
 *
 * Resolves with { path, sizeBytes }.
 */
async function exportClip({ filePath, start, end, target, options = {}, outputDir, onProgress }) {
  validateExport({ start, end, target, options });
  const clipSeconds = Number((end - start).toFixed(3));
  assertExportable(filePath, clipSeconds);

  const exportId = newId();
  const plan = buildClipArgs({ start, duration: clipSeconds, target, options, sourcePath: filePath });
  const outputPath = resolveOutputPath(filePath, outputDir, plan.extension);
  log.info("editor", "exportação iniciada", { exportId, filePath, start, clipSeconds, target, outputPath });

  try {
    if (plan.passes.length === 1) {
      await runFfmpeg({ args: plan.passes[0](filePath, outputPath), clipSeconds, exportId, onProgress });
    } else {
      await runPalettedGif({
        passes: plan.passes,
        sourcePath: filePath,
        outputPath,
        clipSeconds,
        exportId,
        onProgress,
      });
    }
  } catch (e) {
    // A cancelled or failed run can leave a truncated file behind, which would
    // otherwise sit in the folder looking like a successful export.
    fs.rmSync(outputPath, { force: true });
    throw e;
  }

  const sizeBytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
  log.info("editor", "exportação concluída", { exportId, outputPath, sizeBytes });
  return { path: outputPath, sizeBytes, exportId };
}

// The editor is a foreground, one-at-a-time action, so "cancel" means "stop
// whatever is running" — there is no id for the renderer to hold onto, since
// the export call only resolves once it has already finished.
function cancelAll() {
  const ids = [...running.keys()];
  for (const id of ids) {
    running.get(id)?.kill();
    log.info("editor", "exportação cancelada pelo usuário", { exportId: id });
  }
  return ids.length > 0;
}

module.exports = { probe, exportClip, cancelAll };
