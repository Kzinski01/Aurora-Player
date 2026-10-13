const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const childProcess = require("node:child_process");

const calls = [];
const processes = new Map();
const originalSpawn = childProcess.spawn;
childProcess.spawn = (bin, args) => {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = 1000 + calls.length;
  proc.kill = () => queueMicrotask(() => proc.emit("close", 1));
  calls.push({ bin, args, proc });
  if (bin === "taskkill") {
    queueMicrotask(() => {
      processes.get(Number(args[1]))?.emit("close", 1);
      proc.emit("close", 0);
    });
  } else processes.set(proc.pid, proc);
  return proc;
};

function mock(relative, exports) {
  const resolved = require.resolve(relative);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}
mock("../../src/main/binaries", { ensureYtDlp: async () => "yt-dlp", ensureFfmpeg: () => "ffmpeg" });
mock("../../src/main/logger", { info() {}, warn() {}, error() {} });
mock("../../src/main/playlistSync", { syncFromDisk: () => [], annotateLibraryWithPlaylists: (items) => items });
mock("../../src/main/libraryStore", { loadLibrary: () => [], saveLibrary() {} });
mock("../../src/main/profileStore", { incrementDownloadCount() {} });
const { DownloadManager } = require("../../src/main/downloadManager");
childProcess.spawn = originalSpawn;

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("playlist downloads stay sequential, preserve position and report skipped items", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-playlist-test-"));
  const events = [];
  const store = { get: (key) => key === "downloadDir" ? dir : 3, set() {} };
  const win = { isDestroyed: () => false, webContents: { send: (channel, value) => events.push({ channel, value }) } };
  const manager = new DownloadManager(win, store);
  const url = "https://www.youtube.com/playlist?list=PL123";
  manager.analyzedPlaylists.set(url, {
    isPlaylist: true, title: "Música/2026", items: [
      { position: 1, title: "Primeiro", url: "https://www.youtube.com/watch?v=abcdefghijk" },
      { position: 2, title: "Removido", url: null },
      { position: 3, title: "Terceiro", url: "https://www.youtube.com/watch?v=lmnopqrstuv" },
    ],
  });
  const start = calls.length;
  const groupId = await manager.addPlaylist({ url, mode: "video", outputDir: dir });
  await tick();
  assert.equal(calls.length - start, 1);
  assert.ok(calls[start].args.includes("--no-playlist"));
  assert.ok(calls[start].args.includes("--"));
  assert.ok(calls[start].args.some((arg) => arg.includes("001 - ")));
  const firstFile = path.join(dir, "Música_2026", "001 - Primeiro.mp4");
  fs.writeFileSync(firstFile, "fixture");
  calls[start].proc.stdout.emit("data", `[download] Destination: ${firstFile}\n`);
  calls[start].proc.emit("close", 0);
  await tick();
  assert.equal(calls.length - start, 2);
  assert.ok(calls[start + 1].args.some((arg) => arg.includes("003 - ")));
  calls[start + 1].proc.stderr.emit("data", "ERROR: Video unavailable\n");
  calls[start + 1].proc.emit("close", 1);
  await tick();
  const summary = manager.listPlaylists().find((group) => group.id === groupId);
  assert.equal(summary.status, "concluído");
  assert.equal(summary.completed, 1);
  assert.deepEqual(summary.skipped.map((item) => item.position), [2, 3]);
  assert.equal(summary.totalProgress, 1);
  assert.ok(events.some((event) => event.channel === "playlistDownload:update"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("cancelling before process start prevents the first and following item", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-playlist-test-"));
  const manager = new DownloadManager({ isDestroyed: () => false, webContents: { send() {} } }, { get: (key) => key === "downloadDir" ? dir : 3, set() {} });
  const url = "https://www.youtube.com/playlist?list=PL456";
  manager.analyzedPlaylists.set(url, { isPlaylist: true, title: "Teste", items: [
    { position: 1, title: "Um", url: "https://www.youtube.com/watch?v=abcdefghijk" },
    { position: 2, title: "Dois", url: "https://www.youtube.com/watch?v=lmnopqrstuv" },
  ] });
  const start = calls.length;
  const id = await manager.addPlaylist({ url, mode: "audio", outputDir: dir });
  manager.cancelPlaylist(id);
  await tick();
  assert.equal(calls.length, start);
  assert.equal(manager.listPlaylists()[0].status, "cancelado");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("cancelling an active playlist stops its process tree and does not start the next item", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-playlist-test-"));
  const manager = new DownloadManager({ isDestroyed: () => false, webContents: { send() {} } }, { get: (key) => key === "downloadDir" ? dir : 3, set() {} });
  const url = "https://www.youtube.com/playlist?list=PL789";
  manager.analyzedPlaylists.set(url, { isPlaylist: true, title: "Teste", items: [
    { position: 1, title: "Um", url: "https://www.youtube.com/watch?v=abcdefghijk" },
    { position: 2, title: "Dois", url: "https://www.youtube.com/watch?v=lmnopqrstuv" },
  ] });
  const start = calls.length;
  const id = await manager.addPlaylist({ url, mode: "audio", outputDir: dir });
  await tick();
  manager.cancelPlaylist(id);
  await tick();
  assert.equal(calls.slice(start).filter((call) => call.bin === "yt-dlp").length, 1);
  assert.ok(calls.slice(start).some((call) => call.bin === "taskkill"));
  assert.equal(manager.listPlaylists()[0].status, "cancelado");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("pause before spawn and immediate resume do not strand the queue", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-pause-test-"));
  const manager = new DownloadManager({ isDestroyed: () => false, webContents: { send() {} } }, { get: (key) => key === "downloadDir" ? dir : 1, set() {} });
  const start = calls.length;
  const id = manager.addJob({ url: "https://www.youtube.com/watch?v=abcdefghijk", mode: "video", outputDir: dir });
  manager.pause(id);
  manager.resume(id);
  await tick();
  assert.equal(calls.slice(start).filter((call) => call.bin === "yt-dlp").length, 1);
  assert.equal(manager.queue.get(id).status, "baixando");
  manager.cancel(id);
  await tick();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("resume while the paused process is closing starts a fresh run", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-pause-test-"));
  const manager = new DownloadManager({ isDestroyed: () => false, webContents: { send() {} } }, { get: (key) => key === "downloadDir" ? dir : 1, set() {} });
  const start = calls.length;
  const id = manager.addJob({ url: "https://www.youtube.com/watch?v=abcdefghijk", mode: "video", outputDir: dir });
  await tick();
  manager.pause(id);
  manager.resume(id);
  await tick();
  assert.equal(calls.slice(start).filter((call) => call.bin === "yt-dlp").length, 2);
  assert.equal(manager.queue.get(id).status, "baixando");
  manager.cancel(id);
  await tick();
  fs.rmSync(dir, { recursive: true, force: true });
});
