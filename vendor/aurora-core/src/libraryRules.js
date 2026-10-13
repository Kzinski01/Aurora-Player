// Pure business rules for the library array — no fs. The adapter is
// responsible for loading/saving the JSON file; these functions just take
// the in-memory array and return a new one (or a derived value).

// Matches yt-dlp's own id extraction closely enough for our purposes: works
// for watch?v=, youtu.be/, and shorts/ URLs; falls back to the raw string so
// at least identical URLs still match each other.
function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:[?&]v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : url.trim();
}

// Builds the library row for a just-completed download job.
function buildLibraryEntry(job) {
  return {
    id: job.id,
    title: job.title,
    uploader: job.uploader || null,
    thumbnail: job.thumbnail,
    mode: job.mode,
    format: job.mode === "audio" ? job.audioFormat : "mp4",
    resolution: job.resolution,
    filePath: job.filePath,
    folder: job.outputDir,
    url: job.url, // kept so imported playlist tracks can be matched back to this item
    downloadedAt: new Date().toISOString(),
    favorite: false,
    removed: false,
    removedAt: null,
  };
}

// A track downloaded again (e.g. via a second playlist referencing the same
// URL, or after being removed then re-downloaded) must not create a second
// library row for the same video — this revives/updates the existing one
// instead, otherwise the library ends up with visible duplicates. Returns a
// new array (does not mutate the input).
function upsertLibraryEntry(library, job) {
  const videoId = extractVideoId(job.url);
  const existingIdx = library.findIndex((i) => extractVideoId(i.url) === videoId);
  const entry = buildLibraryEntry(job);

  if (existingIdx === -1) {
    return { library: [entry, ...library], entry, wasRestored: false };
  }
  // Keep the existing row's id — playlists and anything else that stores a
  // libraryId reference this entry by id, and swapping in the new job's id
  // here would silently orphan every one of those references.
  entry.id = library[existingIdx].id;
  entry.favorite = library[existingIdx].favorite;
  const wasRestored = library[existingIdx].removed;
  const next = [...library];
  next[existingIdx] = entry;
  return { library: next, entry, wasRestored };
}

// Whether a file was deleted straight from disk (outside the app) isn't
// persisted — it's checked fresh every time the library is read, so the UI
// can dim it as "file missing" without watching the filesystem. `fileExists`
// is injected so this stays pure (desktop: fs.existsSync; mobile: whatever
// the native filesystem plugin exposes).
function annotateLibraryFileStatus(library, fileExists) {
  return library.map((item) => ({
    ...item,
    fileMissing: !(item.filePath && fileExists(item.filePath)),
  }));
}

module.exports = { extractVideoId, buildLibraryEntry, upsertLibraryEntry, annotateLibraryFileStatus };
