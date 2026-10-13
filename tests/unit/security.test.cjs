const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { validateImportPayload, normalizeProfile, validatePreferences, validateAvatarName } = require("../../src/main/profileValidation");
const { validateExport } = require("../../src/main/exportValidation");
const { validateMediaUrl } = require("../../src/main/downloadInput");
const { trustWindow, isTrustedSender } = require("../../src/main/windowSecurity");
const { inside, configureSession } = require("../../src/main/sessionSecurity");

const base = { id: "test", username: "Visitante", theme: "system", accentColor: "#7C6CFF", avatarFile: null, stats: { totalDownloads: 0 } };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");

test("profile import rejects path traversal, executable avatars and oversized data", () => {
  for (const name of ["../config.json", "..\\config.json", "C:\\secret.txt", "avatar.svg", "avatar.exe", "avatar.png:payload"]) {
    assert.throws(() => validateImportPayload({ version: 1, profile: base, avatarFileName: name, avatarBase64: png }));
  }
  assert.throws(() => validateImportPayload({ version: 1, profile: base, avatarFileName: "avatar.png", avatarBase64: "A".repeat(8 * 1024 * 1024) }));
  assert.throws(() => validateAvatarName("avatar.png/../secret"));
});

test("profile import validates version, image signature, base64 and preference types", () => {
  assert.throws(() => validateImportPayload({ profile: base }));
  assert.throws(() => validateImportPayload({ version: 1, profile: base, avatarFileName: "avatar.jpg", avatarBase64: png }));
  assert.throws(() => validateImportPayload({ version: 1, profile: base, avatarFileName: "avatar.png", avatarBase64: "!!!" }));
  assert.throws(() => validatePreferences({ accentColor: "red; background:url(file:///secret)" }));
  assert.throws(() => validatePreferences({ theme: "unknown" }));
  assert.throws(() => validatePreferences({ downloadDir: "C:\\" }));
  assert.doesNotThrow(() => validateImportPayload({ version: 1, profile: base, avatarFileName: "avatar.png", avatarBase64: png }));
});

test("profile normalization keeps allowed fields and safe download counts", () => {
  const actual = normalizeProfile(base, { ...base, username: "  Ana  ", stats: { totalDownloads: -1, token: "secret" }, arbitrary: "value" });
  assert.equal(actual.username, "Ana");
  assert.deepEqual(actual.stats, { totalDownloads: 0 });
  assert.equal(actual.arbitrary, undefined);
});

test("export rejects filter injection, unknown options and invalid ranges", () => {
  for (const options of [{ width: "480,movie=secret" }, { fps: "15;movie=file" }, { audioFormat: "../../../file" }, { preset: "-exec" }, { crf: 100 }, { quality: -1 }, { unknown: true }]) {
    assert.throws(() => validateExport({ start: 0, end: 4, target: "video", options }));
  }
  for (const [start, end] of [[-1, 4], [NaN, 4], [0, Infinity], [4, 4], [5, 4]]) assert.throws(() => validateExport({ start, end, target: "audio" }));
  assert.doesNotThrow(() => validateExport({ start: 0, end: 4, target: "gif", options: { width: 480, fps: 15 } }));
});

test("media URLs reject trailing-dot local hosts, encoded loopback and reserved addresses", () => {
  for (const url of ["http://localhost./", "http://127.0.0.1./", "http://2130706433/", "http://0x7f000001/", "http://192.0.2.1/", "http://198.18.0.1/", "http://224.0.0.1/", "http://router/"]) assert.throws(() => validateMediaUrl(url), url);
});

test("IPC accepts only the registered document, top frame and permitted window role", () => {
  const documentPath = path.resolve("src/renderer/dist/index.html");
  const frame = { url: pathToFileURL(documentPath).href };
  const contents = { mainFrame: frame, setWindowOpenHandler() {}, on() {} };
  const window = { webContents: contents, once() {} };
  trustWindow(window, documentPath, "main");
  assert.equal(isTrustedSender({ sender: contents, senderFrame: frame }), true);
  assert.equal(isTrustedSender({ sender: contents, senderFrame: { ...frame } }), false);
  assert.equal(isTrustedSender({ sender: contents, senderFrame: frame }, ["mini"]), false);
  frame.url = "https://attacker.example/";
  assert.equal(isTrustedSender({ sender: contents, senderFrame: frame }), false);
  assert.equal(isTrustedSender({ sender: {}, senderFrame: frame }), false);
});

test("renderer file requests cannot read unrelated local files or private URLs", () => {
  const root = path.resolve(".");
  let filter;
  configureSession({ webRequest: { onBeforeRequest(fn) { filter = fn; } } }, { root, avatarPath: () => null, isLibraryMediaPath: () => false });
  const blocked = (url, resourceType = "image") => { let result; filter({ url, resourceType }, (value) => result = value.cancel); return result; };
  assert.equal(blocked(pathToFileURL(path.join(root, "assets/icon.png")).href), false);
  assert.equal(blocked(pathToFileURL(path.join(root, "package.json")).href), true);
  assert.equal(blocked("http://127.0.0.1:8080/secret"), true);
  assert.equal(blocked("https://i.ytimg.com/vi/abc/default.jpg"), false);
  assert.equal(inside(path.join(root, "..", "aurora-desktop-other"), root), false);
});
