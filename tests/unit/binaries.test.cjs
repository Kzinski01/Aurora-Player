const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const electronModule = require.resolve("electron");
require.cache[electronModule] = {
  id: electronModule,
  filename: electronModule,
  loaded: true,
  exports: { app: { getPath: () => __dirname, isPackaged: false } },
};
const { configureFfmpegPath, validateFfmpegPath, ensureFfmpeg, ensureFfprobe } = require("../../src/main/binaries");

test("custom FFmpeg requires an absolute ffmpeg.exe path and matching ffprobe", async () => {
  await assert.rejects(validateFfmpegPath("ffmpeg.exe"), /ffmpeg\.exe/);
  await assert.rejects(validateFfmpegPath(path.join(__dirname, "ffmpeg.exe")), /ffprobe\.exe/);
});

const bundled = path.resolve(__dirname, "../../resources/bin/ffmpeg.exe");
test("valid custom FFmpeg is used together with its sibling ffprobe", { skip: !fs.existsSync(bundled) }, async () => {
  const selected = await validateFfmpegPath(bundled);
  configureFfmpegPath(selected);
  assert.equal(ensureFfmpeg(), selected);
  assert.equal(ensureFfprobe(), path.join(path.dirname(selected), "ffprobe.exe"));
  configureFfmpegPath(null);
});
