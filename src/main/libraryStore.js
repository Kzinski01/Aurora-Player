const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");
const { annotateLibraryFileStatus } = require("aurora-core");
const log = require("./logger");
let readFailure = null;

// The library lives in its own folder/file — config.json (electron-store)
// is reserved for app settings only (downloadDir, maxConcurrent, theme...).
function libraryDir() {
  const dir = path.join(app.getPath("userData"), "Biblioteca");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function libraryFile() {
  return path.join(libraryDir(), "library.json");
}

function loadLibrary() {
  const file = libraryFile();
  const backup = `${file}.bak`;
  if (!fs.existsSync(file) && fs.existsSync(backup)) fs.renameSync(backup, file);
  if (!fs.existsSync(file)) {
    readFailure = null;
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data.library)) throw new Error("Campo library ausente ou inválido.");
    readFailure = null;
    return data.library;
  } catch (e) {
    if (!readFailure) log.error("library", "falha ao ler o arquivo da biblioteca", { file, message: e.message });
    readFailure = e;
    return [];
  }
}

function saveLibrary(library) {
  if (readFailure) throw new Error("A biblioteca está corrompida; os dados existentes foram preservados. Restaure o arquivo antes de salvar.");
  const file = libraryFile();
  const backup = `${file}.bak`;
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify({ library }, null, 2), "utf8");
    if (fs.existsSync(file)) {
      fs.rmSync(backup, { force: true });
      fs.renameSync(file, backup);
    }
    try {
      fs.renameSync(temp, file);
      fs.rmSync(backup, { force: true });
    } catch (error) {
      if (fs.existsSync(backup) && !fs.existsSync(file)) fs.renameSync(backup, file);
      throw error;
    }
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function libraryReadError() { return readFailure; }

// Whether a file was deleted straight from disk (outside the app) isn't
// something we persist — it's checked fresh every time the library is read,
// so the UI can dim it as "file missing" without the app having to watch the
// filesystem or the user having to use the in-app delete button.
function annotateLibrary(library) {
  return annotateLibraryFileStatus(library, fs.existsSync);
}

module.exports = { libraryDir, libraryFile, loadLibrary, saveLibrary, annotateLibrary, libraryReadError };
