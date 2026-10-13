const AUDIO_FORMATS = new Set(["mp3", "flac", "wav", "aac", "opus", "m4a"]);

// Builds the yt-dlp CLI argument list for a job. Pure — takes plain values in,
// returns a plain array out. `outTemplate` and `ffmpegPath` are passed in
// rather than computed here so this has no opinion on filesystem layout,
// which differs between desktop (userData) and mobile (app-private storage).
function buildYtDlpArgs(job, { outTemplate, ffmpegPath }) {
  // --no-playlist: a pasted "watch?v=...&list=..." URL must download only that
  // video, not the whole playlist it happens to belong to. Without this flag
  // yt-dlp silently downloads every playlist item under a single job, causing
  // progress to loop and only the last file to be tracked.
  const args = ["--newline", "--no-warnings", "--no-playlist", "--encoding", "utf-8", "--ffmpeg-location", ffmpegPath, "-o", outTemplate];

  if (job.mode === "audio") {
    args.push("-x", "--audio-format", job.audioFormat || "mp3", "--audio-quality", "0");
  } else {
    const res = Number.isFinite(Number(job.resolution)) ? Number(job.resolution) : null;
    const fmt = res ? `bestvideo[height<=${res}]+bestaudio/best[height<=${res}]` : "bestvideo+bestaudio/best";
    args.push("-f", fmt, "--merge-output-format", "mp4");
  }
  args.push(job.url);
  return args;
}

// Parses a single line of yt-dlp's --newline stdout/stderr into a state
// patch, or null if the line carries no relevant signal. Pure text→object —
// the adapter on each platform is responsible for reading process output
// line by line and feeding it here (desktop: child_process 'data' events
// split on \r|\n; mobile: the native plugin's output-line events).
function parseProgressLine(line) {
  const m = line.match(
    /\[download\]\s+([\d.]+)% of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s|Unknown speed)\s+ETA\s+([\d:]+|Unknown)/
  );
  if (m) {
    return {
      status: "baixando",
      progress: parseFloat(m[1]) / 100,
      sizeText: m[2],
      speed: m[3],
      eta: m[4],
    };
  }

  if (/\[Merger\]|\[ExtractAudio\]|Destination:/.test(line)) {
    const dest = line.match(/Destination:\s+(.+)$/) || line.match(/\[Merger\] Merging formats into "(.+)"$/);
    return { status: "convertendo", ...(dest ? { filePath: dest[1].trim() } : {}) };
  }

  // When the target file already exists, yt-dlp skips straight to this line
  // instead of printing "Destination:" — without catching it, filePath stays
  // null and the item lands in the library unable to be played.
  const alreadyDownloaded = line.match(/^\[download\]\s+(.+?)\s+has already been downloaded$/);
  if (alreadyDownloaded) {
    return { filePath: alreadyDownloaded[1].trim() };
  }

  const dest = line.match(/Destination:\s+(.+)$/) || line.match(/\[Merger\] Merging formats into "(.+)"$/);
  if (dest) {
    return { filePath: dest[1].trim() };
  }

  return null;
}

module.exports = { AUDIO_FORMATS, buildYtDlpArgs, parseProgressLine };
