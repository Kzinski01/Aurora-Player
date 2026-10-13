const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");
const { app } = require("electron");
const localBin = path.join(__dirname, "..", "..", "resources", "bin");

const YTDLP_LATEST_API = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
let customFfmpegPath = null;
let updateInProgress = null;

function configureFfmpegPath(value) {
  customFfmpegPath = typeof value === "string" && value ? value : null;
}

async function validateFfmpegPath(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || path.basename(value).toLowerCase() !== "ffmpeg.exe") {
    throw new Error("Escolha um arquivo ffmpeg.exe válido.");
  }
  const ffmpeg = path.resolve(value);
  const ffprobe = path.join(path.dirname(ffmpeg), "ffprobe.exe");
  if (!fs.existsSync(ffmpeg) || !fs.statSync(ffmpeg).isFile() || !fs.existsSync(ffprobe) || !fs.statSync(ffprobe).isFile()) {
    throw new Error("FFmpeg e ffprobe.exe precisam estar na mesma pasta.");
  }
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([getVersion(ffmpeg, ["-version"]), getVersion(ffprobe, ["-version"])]);
  if (!/^ffmpeg version\s/i.test(ffmpegVersion || "") || !/^ffprobe version\s/i.test(ffprobeVersion || "")) {
    throw new Error("Os executáveis selecionados não responderam como FFmpeg e ffprobe.");
  }
  return ffmpeg;
}

function binDir() {
  const dir = path.join(app.getPath("userData"), "bin");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ytDlpPath() {
  return path.join(binDir(), "yt-dlp.exe");
}

// In the packaged app, yt-dlp/ffmpeg/ffprobe ship as extraResources installed
// alongside the app — no runtime download or first-launch copy needed. Dev
// builds have no resourcesPath bin, so they keep the download/copy fallback.
function packagedBinPath(name) {
  const p = path.join(process.resourcesPath, "bin", name);
  return app.isPackaged && fs.existsSync(p) ? p : null;
}

function trustedReleaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !["github.com", "api.github.com", "githubusercontent.com"].some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    throw new Error("Redirecionamento de download não confiável.");
  }
  return parsed;
}

function getReleaseResponse(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Redirecionamentos demais ao baixar yt-dlp."));
    const request = https.get(trustedReleaseUrl(url), { headers: { "User-Agent": "aurora-downloader" }, timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        getReleaseResponse(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
      } else if (res.statusCode === 200) {
        resolve(res);
      } else {
        res.resume();
        reject(new Error(`Falha ao baixar yt-dlp: HTTP ${res.statusCode}`));
      }
    });
    request.on("timeout", () => request.destroy(new Error("Tempo limite ao baixar yt-dlp.")));
    request.on("error", reject);
  });
}

async function download(url, dest, expectedSha256, onProgress) {
  const temp = `${dest}.${crypto.randomUUID()}.tmp`;
  const backup = `${dest}.bak`;
  try {
    const res = await getReleaseResponse(url);
    const total = Number(res.headers["content-length"]) || 0;
    let received = 0;
    const hash = crypto.createHash("sha256");
    res.on("data", (chunk) => {
      received += chunk.length;
      hash.update(chunk);
      if (onProgress && total) onProgress(received / total);
    });
    await pipeline(res, fs.createWriteStream(temp, { flags: "wx" }));
    if (received === 0 || (total && received !== total)) throw new Error("Download do yt-dlp incompleto.");
    if (hash.digest("hex").toLowerCase() !== expectedSha256.toLowerCase()) throw new Error("A verificação SHA-256 do yt-dlp falhou.");
    if (fs.existsSync(dest)) {
      fs.rmSync(backup, { force: true });
      fs.renameSync(dest, backup);
    }
    try {
      fs.renameSync(temp, dest);
      fs.rmSync(backup, { force: true });
    } catch (error) {
      if (fs.existsSync(backup) && !fs.existsSync(dest)) fs.renameSync(backup, dest);
      throw error;
    }
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

async function releaseArtifact() {
  const release = await httpsGetJson(YTDLP_LATEST_API);
  const executable = release.assets?.find((asset) => asset.name === "yt-dlp.exe");
  if (!executable?.browser_download_url) throw new Error("Executável yt-dlp ausente na versão publicada.");
  let expectedSha256 = /^sha256:([a-f\d]{64})$/i.exec(executable.digest || "")?.[1];
  if (!expectedSha256) {
    const checksums = release.assets.find((asset) => asset.name === "SHA2-256SUMS");
    if (!checksums?.browser_download_url) throw new Error("Checksum do yt-dlp indisponível.");
    const response = await getReleaseResponse(checksums.browser_download_url);
    let body = "";
    for await (const chunk of response) {
      body += chunk;
      if (body.length > 100000) throw new Error("Arquivo de checksum grande demais.");
    }
    expectedSha256 = /^([a-f\d]{64})\s+\*?yt-dlp\.exe\s*$/im.exec(body)?.[1];
  }
  if (!expectedSha256) throw new Error("Checksum do yt-dlp indisponível.");
  return { url: executable.browser_download_url, expectedSha256 };
}

// A copy in userData/bin always wins over the bundled one — that's either the
// dev-mode download fallback, or a newer build the user pulled in via
// "Atualizar yt-dlp" in Configurações (sites change often enough that the
// version pinned at install time can stop working before the app is
// reinstalled). Only when neither exists does the packaged copy get used.
async function ensureYtDlp(onProgress) {
  const dest = ytDlpPath();
  if (!fs.existsSync(dest) && fs.existsSync(`${dest}.bak`)) fs.renameSync(`${dest}.bak`, dest);
  if (fs.existsSync(dest)) return dest;

  const packaged = packagedBinPath("yt-dlp.exe");
  if (packaged) return packaged;

  const local = path.join(__dirname, "..", "..", "resources", "bin", "yt-dlp.exe");
  if (fs.existsSync(local)) return local;

  const artifact = await releaseArtifact();
  await download(artifact.url, dest, artifact.expectedSha256, onProgress);
  return dest;
}

function getVersion(binPath, args = ["--version"]) {
  return new Promise((resolve) => {
    if (!binPath || !fs.existsSync(binPath)) {
      resolve(null);
      return;
    }
    const proc = spawn(binPath, args, { windowsHide: true });
    let out = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => { proc.kill(); finish(null); }, 5000);
    proc.stdout.on("data", (d) => {
      out = (out + d.toString()).slice(0, 4096);
      if (out.length >= 4096) { proc.kill(); finish(null); }
    });
    proc.stderr?.resume();
    proc.on("close", (code) => finish(code === 0 ? out.trim().split(/\r?\n/)[0] || null : null));
    proc.on("error", () => finish(null));
  });
}

async function httpsGetJson(url) {
  const res = await getReleaseResponse(url);
  let body = "";
  for await (const chunk of res) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error("Resposta de atualização grande demais.");
  }
  return JSON.parse(body);
}

// Reports installed versions plus whether a newer yt-dlp is available —
// yt-dlp is the piece that actually breaks over time as sites change their
// pages; ffmpeg/ffprobe rarely need to move, so only yt-dlp gets an "update"
// action, the other two are just informational.
async function checkDependencyVersions() {
  const ytDlp = await ensureYtDlp().catch(() => null);
  let ffmpeg = null;
  let ffmpegError = null;
  try {
    ffmpeg = ensureFfmpeg();
  } catch (error) {
    ffmpegError = error.message;
  }
  const ffprobe = ffmpeg ? ensureFfprobe() : null;

  const [ytDlpVersion, ffmpegVersionRaw, ffprobeVersionRaw] = await Promise.all([
    getVersion(ytDlp),
    getVersion(ffmpeg, ["-version"]),
    getVersion(ffprobe, ["-version"]),
  ]);

  let latestYtDlpVersion = null;
  let checkError = null;
  try {
    const release = await httpsGetJson(YTDLP_LATEST_API);
    latestYtDlpVersion = release.tag_name || null;
  } catch (e) {
    checkError = "Não foi possível verificar atualizações agora — confira sua conexão com a internet.";
  }

  return {
    ytDlpVersion,
    ffmpegVersion: ffmpegVersionRaw ? ffmpegVersionRaw.split(" ").slice(0, 3).join(" ") : null,
    ffprobeVersion: ffprobeVersionRaw ? ffprobeVersionRaw.split(" ").slice(0, 3).join(" ") : null,
    latestYtDlpVersion,
    ytDlpUpdateAvailable: !!(latestYtDlpVersion && ytDlpVersion && latestYtDlpVersion !== ytDlpVersion),
    checkError: ffmpegError || checkError,
  };
}

// Always downloads into userData/bin, even in the packaged app — see the
// precedence note on ensureYtDlp above.
async function updateYtDlp(onProgress) {
  if (updateInProgress) return updateInProgress;
  updateInProgress = (async () => {
    const dest = ytDlpPath();
    const artifact = await releaseArtifact();
    await download(artifact.url, dest, artifact.expectedSha256, onProgress);
    return getVersion(dest);
  })();
  try { return await updateInProgress; }
  finally { updateInProgress = null; }
}

// yt-dlp espera FFmpeg e FFprobe na mesma pasta. O instalador usa resources/bin;
// no desenvolvimento, prepare:binaries cria essa pasta a partir do manifesto.
function ensureFfmpeg() {
  if (customFfmpegPath) {
    if (!fs.existsSync(customFfmpegPath) || !fs.existsSync(path.join(path.dirname(customFfmpegPath), "ffprobe.exe"))) {
      throw new Error("FFmpeg personalizado não encontrado. Escolha outro executável nas Configurações.");
    }
    return customFfmpegPath;
  }
  const packaged = packagedBinPath("ffmpeg.exe");
  if (packaged) return packaged;

  const local = path.join(localBin, "ffmpeg.exe");
  if (!fs.existsSync(local) || !fs.existsSync(path.join(localBin, "ffprobe.exe"))) {
    throw new Error("Execute npm run prepare:binaries para preparar FFmpeg e FFprobe.");
  }
  return local;
}

// ffprobe always lives beside ffmpeg (ensureFfmpeg is what guarantees it — see
// the note above), so this is the sibling lookup rather than a second search.
// Exported because both the dependency check and the media editor need it, and
// each was otherwise rebuilding the same path by hand.
function ensureFfprobe() {
  const ffmpeg = ensureFfmpeg();
  return path.join(path.dirname(ffmpeg), "ffprobe.exe");
}

module.exports = { ensureYtDlp, ensureFfmpeg, ensureFfprobe, ytDlpPath, binDir, checkDependencyVersions, updateYtDlp, configureFfmpegPath, validateFfmpegPath };
