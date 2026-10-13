const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");
const { defaultProfile: coreDefaultProfile } = require("aurora-core");
const { MAX_PROFILE_BYTES, MAX_AVATAR_BYTES, normalizeProfile, validateImportPayload, validateAvatarName, validateAvatarBytes } = require("./profileValidation");
const log = require("./logger");

// Local-only profile — no accounts, no login. Lives in its own folder so it's
// obviously separable from app settings (config.json) and the library.
function profileDir() {
  const dir = path.join(app.getPath("userData"), "Profile");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function profileFile() {
  return path.join(profileDir(), "profile.json");
}

function defaultProfile() {
  return coreDefaultProfile(() => crypto.randomUUID());
}

// Merging over defaultProfile() means a profile.json written by an older
// app version (missing a field a newer version added) still loads cleanly.
function loadProfile() {
  const file = profileFile();
  if (!fs.existsSync(file)) {
    const p = defaultProfile();
    saveProfile(p);
    return p;
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return normalizeProfile(defaultProfile(), data);
  } catch (e) {
    log.error("profile", "falha ao ler perfil. Recriando um novo", { message: e.message });
    const p = defaultProfile();
    saveProfile(p);
    return p;
  }
}

function saveProfile(profile) {
  const validated = normalizeProfile(defaultProfile(), profile);
  const temporary = `${profileFile()}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(validated, null, 2), "utf8");
    fs.renameSync(temporary, profileFile());
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function touchLastAccess() {
  const p = loadProfile();
  p.lastAccessAt = new Date().toISOString();
  saveProfile(p);
  return p;
}

function incrementDownloadCount() {
  const p = loadProfile();
  p.stats.totalDownloads = (p.stats.totalDownloads || 0) + 1;
  saveProfile(p);
}

// Copies the chosen photo into Profile/ as avatar.<ext>, replacing whatever
// was there before (even under a different extension) so switching formats
// doesn't leave orphaned image files behind.
function setAvatarFromPath(srcPath) {
  const dir = profileDir();
  const ext = path.extname(srcPath).toLowerCase() || ".png";
  const dest = path.join(dir, `avatar${ext}`);
  if (!fs.statSync(srcPath).isFile() || fs.statSync(srcPath).size > MAX_AVATAR_BYTES) throw new Error("Escolha uma foto de até 5 MB.");
  validateAvatarBytes(fs.readFileSync(srcPath), path.basename(dest));
  for (const name of ["avatar.png", "avatar.jpg", "avatar.jpeg", "avatar.webp"]) {
    const old = path.join(dir, name);
    if (old !== dest && fs.existsSync(old)) fs.unlinkSync(old);
  }
  fs.copyFileSync(srcPath, dest);
  const p = loadProfile();
  p.avatarFile = path.basename(dest);
  saveProfile(p);
  return p;
}

function avatarPath() {
  const p = loadProfile();
  if (!p.avatarFile) return null;
  const full = path.join(profileDir(), validateAvatarName(p.avatarFile));
  return fs.existsSync(full) ? full : null;
}

// Bundles the profile fields + the avatar image (base64-inlined) into one
// plain-JSON ".auroraProfile" file — a single file is enough to restore
// everything, no separate image file to lose track of.
function buildExportPayload() {
  const p = loadProfile();
  const avFull = avatarPath();
  const avatarBase64 = avFull ? fs.readFileSync(avFull).toString("base64") : null;
  return { version: 1, exportedAt: new Date().toISOString(), profile: p, avatarFileName: p.avatarFile, avatarBase64 };
}

// Read-only: parses and validates a .auroraProfile file without writing
// anything, so the caller can show a confirmation preview first.
function readImportPayload(filePath) {
  if (!fs.statSync(filePath).isFile() || fs.statSync(filePath).size > MAX_PROFILE_BYTES) throw new Error("O arquivo de perfil ultrapassa 8 MB.");
  const raw = fs.readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw);
  validateImportPayload(payload);
  normalizeProfile(defaultProfile(), payload.profile);
  return payload;
}

function applyImportPayload(payload) {
  validateImportPayload(payload);
  const p = normalizeProfile(defaultProfile(), payload.profile);
  if (payload.avatarBase64 && payload.avatarFileName) {
    const avatarName = validateAvatarName(payload.avatarFileName);
    fs.writeFileSync(path.join(profileDir(), avatarName), Buffer.from(payload.avatarBase64, "base64"));
    p.avatarFile = avatarName;
  } else {
    p.avatarFile = null;
  }
  saveProfile(p);
  return p;
}

module.exports = {
  profileDir,
  profileFile,
  loadProfile,
  saveProfile,
  touchLastAccess,
  incrementDownloadCount,
  setAvatarFromPath,
  avatarPath,
  buildExportPayload,
  readImportPayload,
  applyImportPayload,
};
