// Pure profile shape + defaulting/merging rules — no fs. `newId` is injected
// so this doesn't hard-depend on Node's crypto module (desktop passes
// `crypto.randomUUID`; mobile can pass the same, since it's available in
// modern WebViews too — see jobFactory.js's randomId for the same pattern).
function defaultProfile(newId) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    username: "Usuário",
    avatarFile: null,
    theme: "system",
    accentColor: "#7C6CFF",
    createdAt: now,
    lastAccessAt: now,
    stats: { totalDownloads: 0 },
  };
}

// Merging over a fresh default means a profile.json written by an older app
// version (missing a field a newer version added) still loads cleanly.
function mergeProfile(base, data) {
  return { ...base, ...data, stats: { ...base.stats, ...((data && data.stats) || {}) } };
}

module.exports = { defaultProfile, mergeProfile };
