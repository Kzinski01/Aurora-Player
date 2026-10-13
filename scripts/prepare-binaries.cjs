const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "resources/binaries.json"), "utf8").replace(/^\uFEFF/, ""));
const bin = path.join(root, "resources/bin");

async function downloadVerified(artifact, destination) {
  const response = await fetch(artifact.url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok || !response.body) throw new Error(`Não foi possível baixar ${artifact.url}: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination, { flags: "wx" }));
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(destination)) hash.update(chunk);
  if (hash.digest("hex") !== artifact.sha256) throw new Error("O SHA-256 do binário não confere. O arquivo não será usado.");
}

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("O instalador atual é para Windows x64.");
  fs.mkdirSync(bin, { recursive: true });
  const stamp = path.join(bin, ".prepared.json");
  if (fs.existsSync(stamp)) {
    const saved = JSON.parse(fs.readFileSync(stamp, "utf8"));
    const valid = saved.manifest === JSON.stringify(manifest) && Object.entries(saved.hashes).every(([name, digest]) =>
      fs.existsSync(path.join(bin, name)) && crypto.createHash("sha256").update(fs.readFileSync(path.join(bin, name))).digest("hex") === digest);
    if (valid) { console.log("Binários conferidos por SHA-256."); return; }
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-binaries-"));
  try {
    const archive = path.join(temporary, "ffmpeg.zip");
    const ytDlp = path.join(temporary, "yt-dlp.exe");
    await Promise.all([downloadVerified(manifest.ffmpeg, archive), downloadVerified(manifest.ytDlp, ytDlp)]);
    const unpack = spawnSync("tar.exe", ["-xf", archive, "-C", temporary], { windowsHide: true, encoding: "utf8" });
    if (unpack.status !== 0) throw new Error(unpack.stderr || "Não foi possível extrair o FFmpeg.");
    const extracted = fs.readdirSync(temporary).find((name) => name.startsWith("ffmpeg-") && fs.statSync(path.join(temporary, name)).isDirectory());
    if (!extracted) throw new Error("A pasta do FFmpeg não foi encontrada no arquivo baixado.");
    for (const name of ["ffmpeg.exe", "ffprobe.exe"]) fs.copyFileSync(path.join(temporary, extracted, "bin", name), path.join(bin, name));
    fs.copyFileSync(ytDlp, path.join(bin, "yt-dlp.exe"));
    const notices = path.join(root, "third-party/ffmpeg");
    fs.mkdirSync(notices, { recursive: true });
    for (const name of fs.readdirSync(path.join(temporary, extracted))) {
      if (/license|copying|readme/i.test(name) && fs.statSync(path.join(temporary, extracted, name)).isFile()) {
        fs.copyFileSync(path.join(temporary, extracted, name), path.join(notices, name));
      }
    }
    const hashes = Object.fromEntries(["ffmpeg.exe", "ffprobe.exe", "yt-dlp.exe"].map((name) =>
      [name, crypto.createHash("sha256").update(fs.readFileSync(path.join(bin, name))).digest("hex")]));
    fs.writeFileSync(stamp, JSON.stringify({ manifest: JSON.stringify(manifest), hashes }, null, 2));
    console.log("FFmpeg, FFprobe e yt-dlp preparados e conferidos por SHA-256.");
  } finally {
    // temporary is created by mkdtemp under os.tmpdir, never supplied by a user.
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
