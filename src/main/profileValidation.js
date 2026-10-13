const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_PROFILE_BYTES = 8 * 1024 * 1024;
const AVATAR_NAME = /^avatar\.(png|jpe?g|webp)$/i;

function validateAvatarName(name) {
  if (typeof name !== "string" || !AVATAR_NAME.test(name)) {
    throw new Error("A foto do perfil precisa ser um arquivo PNG, JPG ou WebP chamado avatar.");
  }
  return name.toLowerCase();
}

function validatePreferences(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Preferências de perfil inválidas.");
  for (const [key, value] of Object.entries(patch)) {
    if (key === "theme" && ["system", "dark", "light"].includes(value)) continue;
    if (key === "accentColor" && typeof value === "string" && /^#[a-f\d]{6}$/i.test(value)) continue;
    throw new Error("Escolha um tema válido e uma cor no formato #RRGGBB.");
  }
  return patch;
}

function normalizeProfile(base, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Arquivo de perfil inválido.");
  const profile = { ...base, stats: { ...base.stats } };
  for (const key of ["id", "username", "createdAt", "lastAccessAt"]) {
    if (typeof value[key] === "string" && value[key].trim()) profile[key] = value[key].trim().slice(0, key === "username" ? 40 : 100);
  }
  Object.assign(profile, validatePreferences({ theme: value.theme ?? base.theme, accentColor: value.accentColor ?? base.accentColor }));
  profile.avatarFile = value.avatarFile == null ? null : validateAvatarName(value.avatarFile);
  const count = value.stats?.totalDownloads;
  if (Number.isSafeInteger(count) && count >= 0) profile.stats.totalDownloads = count;
  return profile;
}

function validateImportPayload(payload) {
  if (!payload || payload.version !== 1 || typeof payload.profile?.id !== "string" ||
    !payload.profile.id.trim() || typeof payload.profile?.username !== "string" || !payload.profile.username.trim()) {
    throw new Error("Arquivo de perfil inválido ou corrompido.");
  }
  if (payload.avatarBase64 != null) {
    validateAvatarName(payload.avatarFileName);
    if (typeof payload.avatarBase64 !== "string" || payload.avatarBase64.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.avatarBase64)) {
      throw new Error("A foto do perfil é inválida ou ultrapassa 5 MB.");
    }
    validateAvatarBytes(Buffer.from(payload.avatarBase64, "base64"), payload.avatarFileName);
  }
  return payload;
}

function validateAvatarBytes(bytes, name) {
  const extension = validateAvatarName(name).split(".")[1];
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (bytes.length > MAX_AVATAR_BYTES || !(extension === "png" ? png : extension === "webp" ? webp : jpeg)) {
    throw new Error("Escolha uma foto PNG, JPG ou WebP de até 5 MB.");
  }
}

module.exports = { MAX_AVATAR_BYTES, MAX_PROFILE_BYTES, validateAvatarName, validateAvatarBytes, validatePreferences, normalizeProfile, validateImportPayload };
