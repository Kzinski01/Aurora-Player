const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aurora-library-test-"));
const electronPath = require.resolve("electron");
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true, exports: { app: { getPath: () => userData } } };
const loggerPath = require.resolve("../../src/main/logger");
require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: { error() {} } };
const { libraryFile, loadLibrary, saveLibrary, libraryReadError } = require("../../src/main/libraryStore");

test("library writes atomically and refuses to replace corrupt data", () => {
  saveLibrary([{ id: "first" }]);
  assert.deepEqual(loadLibrary(), [{ id: "first" }]);
  const file = libraryFile();
  fs.writeFileSync(file, "{broken", "utf8");
  assert.deepEqual(loadLibrary(), []);
  assert.ok(libraryReadError());
  assert.throws(() => saveLibrary([{ id: "replacement" }]), /corrompida/);
  assert.equal(fs.readFileSync(file, "utf8"), "{broken");
  fs.writeFileSync(file, JSON.stringify({ library: [{ id: "restored" }] }), "utf8");
  assert.deepEqual(loadLibrary(), [{ id: "restored" }]);
  saveLibrary([{ id: "next" }]);
  assert.deepEqual(loadLibrary(), [{ id: "next" }]);
});

test.after(() => fs.rmSync(userData, { recursive: true, force: true }));
