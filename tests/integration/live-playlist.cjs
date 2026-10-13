// Manual network test: downloads a public Internet Archive collection into an
// isolated temporary directory, then removes the downloaded files.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-live-playlist-"));
const binaryDir = path.join(root, "resources", "bin");
const ytDlp = path.join(root, "resources", "bin", "yt-dlp.exe");
const ffmpeg = path.join(binaryDir, "ffmpeg.exe");
const library = [];
const playlistUrl = "https://archive.org/details/Election_Ads";

function mock(relative, exports) {
  const resolved = require.resolve(relative);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

mock("../../src/main/binaries", { ensureYtDlp: async () => ytDlp, ensureFfmpeg: () => ffmpeg });
mock("../../src/main/logger", { info() {}, warn() {}, error() {} });
mock("../../src/main/playlistSync", { syncFromDisk: () => [], annotateLibraryWithPlaylists: (items) => items });
mock("../../src/main/libraryStore", {
  loadLibrary: () => library,
  saveLibrary: (items) => { library.splice(0, library.length, ...items); },
});
mock("../../src/main/profileStore", { incrementDownloadCount() {} });

const { DownloadManager } = require("../../src/main/downloadManager");
let manager;
let timer;

async function main() {
  assert.ok(fs.existsSync(ytDlp), "yt-dlp executable is missing");
  assert.ok(fs.existsSync(ffmpeg), "ffmpeg executable is missing");
  const store = { get: (key) => key === "downloadDir" ? temp : 1, set() {} };
  manager = new DownloadManager({ isDestroyed: () => false, webContents: { send() {} } }, store);
  const metadata = await manager.fetchMetadata(playlistUrl);
  assert.equal(metadata.isPlaylist, true);
  assert.equal(metadata.items.length, 10);
  assert.ok(metadata.items.every((item) => item.url?.startsWith("https://archive.org/download/Election_Ads/")));
  console.log(`Analyzed: ${metadata.title} (${metadata.items.length} items)`);

  const groupId = await manager.addPlaylist({ url: playlistUrl, mode: "video", outputDir: temp });
  const summary = await new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Live playlist download timed out")), 5 * 60 * 1000);
    const poll = setInterval(() => {
      const group = manager.listPlaylists().find((item) => item.id === groupId);
      if (!group || group.status === "baixando") return;
      clearInterval(poll);
      resolve(group);
    }, 250);
    timer.unref?.();
  });
  console.log(JSON.stringify({ status: summary.status, completed: summary.completed, skipped: summary.skipped }, null, 2));
  assert.equal(summary.status, "concluído");
  assert.equal(summary.completed, metadata.items.length);
  assert.deepEqual(summary.skipped, []);
  const files = fs.readdirSync(summary.outputDir).filter((name) => !name.endsWith(".part")).sort();
  assert.equal(files.length, metadata.items.length);
  assert.deepEqual(files.map((name) => Number(name.slice(0, 3))), metadata.items.map((item) => item.position));
  assert.equal(library.length, metadata.items.length);
  console.log(`Verified ${files.length} numbered files and ${library.length} library entries`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  clearTimeout(timer);
  manager?.shutdown();
  fs.rmSync(temp, { recursive: true, force: true });
});
