const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { validateMediaUrl, validateMetadataInput, safeThumbnailUrl, safeFileName, playlistOutputDir } = require("../../src/main/downloadInput");
const { playlistMetadata, playlistJobFields } = require("../../src/main/playlistPlan");

test("accepts HTTPS media links and normalizes them", () => {
  assert.equal(validateMediaUrl(" https://www.youtube.com/watch?v=abc&list=xyz "), "https://www.youtube.com/watch?v=abc&list=xyz");
  assert.equal(validateMetadataInput("ytsearch1:uma música"), "ytsearch1:uma música");
});

test("rejects dangerous schemes, local hosts, malformed links and flags", () => {
  for (const input of ["", "file:///C:/secret", "ftp://example.com/file", "javascript:alert(1)", "data:text/html,hi", "--exec=calc", "C:\\secret", "http://127.0.0.1/a", "http://172.16.0.1/a", "https://user:pass@example.com", "https://", "https://example.com/\n--flag"]) {
    assert.throws(() => validateMediaUrl(input), input);
  }
  assert.throws(() => validateMetadataInput("ytsearch1:file:///secret"));
  assert.equal(safeThumbnailUrl("file:///C:/secret.png"), null);
});

test("sanitizes Windows directory names and keeps Unicode", () => {
  assert.equal(safeFileName('CON'), '_CON');
  assert.equal(safeFileName('LPT1.txt'), '_LPT1.txt');
  assert.equal(safeFileName('Música: São Paulo?  '), 'Música_ São Paulo_');
  assert.equal(safeFileName('..'), 'Playlist');
  assert.ok(safeFileName('a'.repeat(300)).length <= 70);
  assert.equal(playlistOutputDir(path.resolve('C:/Downloads'), 'A/B'), path.join(path.resolve('C:/Downloads'), 'A_B'));
});

test("playlist plan preserves source positions and marks unavailable entries", () => {
  const source = 'https://www.youtube.com/playlist?list=PL123';
  const meta = playlistMetadata({ _type: 'playlist', title: 'A/B', entries: [
    { id: 'a', title: 'Primeiro', url: 'abcdefghijk' },
    null,
    { id: 'c', title: 'Terceiro', webpage_url: 'https://www.youtube.com/watch?v=third' },
  ] }, source);
  assert.equal(meta.entries, 3);
  assert.deepEqual(meta.items.map((item) => item.position), [1, 2, 3]);
  assert.equal(meta.items[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(meta.items[1].url, null);
  const job = playlistJobFields({ outputDir: path.resolve('C:/Downloads'), title: meta.title, mode: 'audio', audioFormat: 'mp3' }, meta.items[2]);
  assert.equal(job.outputDir, path.join(path.resolve('C:/Downloads'), 'A_B'));
  assert.equal(job.url, meta.items[2].url);
});

test("playlist entries use individual media URLs when webpage_url repeats the collection", () => {
  const source = "https://archive.org/details/Election_Ads";
  const item = "https://archive.org/download/Election_Ads/Commercial-JFK1960ElectionAdCampaignJingle.mpg";
  const meta = playlistMetadata({ _type: "playlist", entries: [
    { title: "Campaign Jingle", url: item, webpage_url: source },
    { title: "Unavailable", webpage_url: source },
  ] }, source);
  assert.equal(meta.items[0].url, item);
  assert.equal(meta.items[1].url, null);
});
