// Builds ffmpeg argument lists for trimming and converting a local file. Pure:
// plain values in, plain arrays out — the desktop adapter owns spawning,
// progress parsing and filesystem paths, exactly as downloadArgs.js does for
// yt-dlp.

const CLIP_TARGETS = new Set(["video", "audio", "gif", "webp"]);

// Container for each audio format, plus the encoder and its quality flag.
// Keyed by the format the user picks, so the UI can offer the same list the
// downloader already offers.
const AUDIO_ENCODERS = {
  mp3: { extension: "mp3", codec: "libmp3lame", quality: ["-q:a", "2"] },
  flac: { extension: "flac", codec: "flac", quality: [] },
  wav: { extension: "wav", codec: "pcm_s16le", quality: [] },
  aac: { extension: "m4a", codec: "aac", quality: ["-b:a", "192k"] },
  opus: { extension: "opus", codec: "libopus", quality: ["-b:a", "160k"] },
  m4a: { extension: "m4a", codec: "aac", quality: ["-b:a", "192k"] },
};

const DEFAULT_GIF_FPS = 15;
const DEFAULT_GIF_WIDTH = 480;

// Placing -ss *before* -i makes ffmpeg seek by keyframe index instead of
// decoding from the start, which is the difference between instant and
// proportional-to-offset. Since ffmpeg 2.1 this stays frame-accurate when the
// output is re-encoded (it decodes from the preceding keyframe and discards the
// excess), so the fast path costs accuracy only in stream-copy mode, where
// there is no decode step to discard anything.
function seekArgs(start, duration) {
  return ["-ss", String(start), "-t", String(duration)];
}

const BASE = ["-hide_banner", "-loglevel", "error", "-progress", "pipe:1", "-nostats", "-nostdin", "-y"];

function scaleFilter(width) {
  // -2 rather than -1: H.264 requires even dimensions, and an odd computed
  // height makes the encoder fail outright on some source aspect ratios.
  return width ? `scale=${width}:-2:flags=lanczos` : null;
}

function buildVideoPass({ start, duration, options }) {
  const precise = options.precise !== false;
  return (input, output) => {
    const args = [...BASE, ...seekArgs(start, duration), "-protocol_whitelist", "file,pipe", "-i", input];
    if (precise) {
      args.push(
        "-c:v", "libx264",
        "-preset", options.preset || "veryfast",
        "-crf", String(options.crf ?? 20),
        "-c:a", "aac",
        "-b:a", "192k",
        // Puts the index at the front so the result starts playing before it
        // has fully loaded — which matters the moment the file is shared.
        "-movflags", "+faststart"
      );
      const scale = scaleFilter(options.width);
      if (scale) args.push("-vf", scale);
    } else {
      // Stream copy: no re-encode, so the cut lands on the nearest keyframe
      // before `start`. Instant, at the cost of an inexact in-point.
      args.push("-c", "copy", "-avoid_negative_ts", "make_zero");
    }
    args.push(output);
    return args;
  };
}

function buildAudioPass({ start, duration, options }) {
  const format = options.audioFormat;
  const encoder = format ? AUDIO_ENCODERS[format] : null;
  return (input, output) => {
    const args = [...BASE, ...seekArgs(start, duration), "-protocol_whitelist", "file,pipe", "-i", input, "-vn"];
    if (encoder) {
      args.push("-c:a", encoder.codec, ...encoder.quality);
    } else {
      // Keeping the source codec is both instantaneous and lossless — the right
      // default when the user only wants a shorter file, not a different one.
      args.push("-c:a", "copy");
    }
    args.push(output);
    return args;
  };
}

// GIF is limited to 256 colours, so a single pass makes ffmpeg fall back to a
// generic palette and the result bands badly. Building a palette from the clip
// first and applying it second is what makes the colours hold up.
function buildGifPasses({ start, duration, options }) {
  const fps = options.fps || DEFAULT_GIF_FPS;
  const width = options.width || DEFAULT_GIF_WIDTH;
  const chain = `fps=${fps},${scaleFilter(width)}`;

  const palettePass = (input, palette) => [
    ...BASE,
    ...seekArgs(start, duration),
    "-protocol_whitelist", "file,pipe", "-i", input,
    // stats_mode=diff weights the palette toward what actually moves, rather
    // than letting a large static background dictate the colours.
    "-vf", `${chain},palettegen=stats_mode=diff`,
    palette,
  ];

  const encodePass = (input, output, palette) => [
    ...BASE,
    ...seekArgs(start, duration),
    "-protocol_whitelist", "file,pipe", "-i", input,
    "-protocol_whitelist", "file,pipe", "-i", palette,
    "-lavfi", `${chain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
    "-loop", "0",
    output,
  ];

  return [palettePass, encodePass];
}

// Animated WebP: same selection as the GIF path but a real video codec, so it
// keeps full colour at a fraction of the size. Offered alongside GIF because
// GIF is only the better choice where WebP isn't supported.
function buildWebpPass({ start, duration, options }) {
  const fps = options.fps || DEFAULT_GIF_FPS;
  const width = options.width || DEFAULT_GIF_WIDTH;
  return (input, output) => [
    ...BASE,
    ...seekArgs(start, duration),
    "-protocol_whitelist", "file,pipe", "-i", input,
    "-vf", `fps=${fps},${scaleFilter(width)}`,
    "-c:v", "libwebp_anim",
    "-lossless", "0",
    "-q:v", String(options.quality ?? 70),
    "-loop", "0",
    "-an",
    output,
  ];
}

/**
 * Returns { extension, passes } for a clip export.
 *
 * `passes` is an array of functions producing argv arrays. Most targets need a
 * single pass; GIF needs two (palette, then encode) and receives the palette
 * path as a third argument.
 */
function buildClipArgs({ start, duration, target, options = {}, sourcePath = "" }) {
  if (!CLIP_TARGETS.has(target)) throw new Error(`Tipo de exportação desconhecido: ${target}`);

  if (target === "gif") {
    return { extension: "gif", passes: buildGifPasses({ start, duration, options }) };
  }
  if (target === "webp") {
    return { extension: "webp", passes: [buildWebpPass({ start, duration, options })] };
  }
  if (target === "audio") {
    const encoder = options.audioFormat ? AUDIO_ENCODERS[options.audioFormat] : null;
    // Copying the stream means the container must stay compatible with it, so
    // the source's own extension is the only safe choice.
    const extension = encoder ? encoder.extension : extensionOf(sourcePath) || "m4a";
    return { extension, passes: [buildAudioPass({ start, duration, options })] };
  }

  const extension = options.precise === false ? extensionOf(sourcePath) || "mp4" : "mp4";
  return { extension, passes: [buildVideoPass({ start, duration, options })] };
}

function extensionOf(filePath) {
  const match = /\.([A-Za-z0-9]+)$/.exec(filePath || "");
  return match ? match[1].toLowerCase() : null;
}

// Suffix added to an exported clip's filename. Kept here so the naming stays
// consistent wherever exports are produced.
function clipOutputName(baseName) {
  return `${baseName} (corte)`;
}

// Only what the desktop adapter actually calls. The tables and defaults above
// are implementation detail of this module — exporting them would invite
// callers to depend on the shape of an ffmpeg invocation.
module.exports = { buildClipArgs, clipOutputName };
