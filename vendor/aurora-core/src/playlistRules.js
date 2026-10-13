const { extractVideoId } = require("./libraryRules");

function slugify(name) {
  return (
    (name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "playlist"
  );
}

function buildLibraryIndexes(library) {
  const byId = new Map(library.map((i) => [i.id, i]));
  const byVideoId = new Map();
  for (const item of library) {
    const vid = extractVideoId(item.url);
    if (vid && !byVideoId.has(vid)) byVideoId.set(vid, item);
  }
  return { byId, byVideoId };
}

// Resolves a raw on-disk track entry to its videoId, whether it's already
// minimal (music_ID pointing at a library entry) or still "pending" (a raw
// url, for a track not downloaded yet).
function trackVideoId(rawTrack, libraryById) {
  if (rawTrack.music_ID) {
    const item = libraryById.get(rawTrack.music_ID);
    return item ? extractVideoId(item.url) : null;
  }
  return extractVideoId(rawTrack.url);
}

// Reconciles one playlist's raw tracks against the library: resolves each
// track to its library entry (by music_ID, falling back to matching a
// pending entry's url against the library by videoId), and returns both the
// UI-facing track list and the minimal { id, music_ID } form that should be
// persisted back to disk once a match is found — a track's file never
// duplicates title/url/mode/format once the library already has that data.
// Tracks with no library match yet keep their raw fields so the app still
// knows what to download. `fileExists` is injected to keep this pure.
function reconcilePlaylistTracks(rawTracks, library, fileExists) {
  const { byId: libraryById, byVideoId: libraryByVideoId } = buildLibraryIndexes(library);
  const sortedRaw = [...rawTracks].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const tracks = [];
  const normalized = [];
  let changed = false;

  for (const t of sortedRaw) {
    const item = t.music_ID ? libraryById.get(t.music_ID) : t.url ? libraryByVideoId.get(extractVideoId(t.url)) : null;

    if (item) {
      // Active = not soft-deleted and its file still exists on disk — an
      // inactive match still resolves title/url (nothing's lost) but
      // doesn't count as "already downloaded" for playlist completeness.
      const isActive = !item.removed && item.filePath && fileExists(item.filePath);
      tracks.push({
        position: t.id,
        title: item.title,
        url: item.url,
        mode: item.mode,
        format: item.mode === "audio" ? item.format : item.resolution,
        videoId: extractVideoId(item.url),
        libraryId: isActive ? item.id : null,
      });
      const minimal = { id: t.id, music_ID: item.id };
      normalized.push(minimal);
      if (t.music_ID !== item.id || Object.keys(t).length !== 2) changed = true;
    } else {
      tracks.push({
        position: t.id,
        title: t.title || null,
        url: t.url || null,
        mode: t.mode === "video" ? "video" : "audio",
        format: t.format ?? null,
        videoId: extractVideoId(t.url),
        libraryId: null,
      });
      normalized.push(t);
    }
  }

  return { tracks, normalized, changed };
}

// Raw membership check (ignores whether the library entry is still active) —
// used to tell whether a library item belongs to any playlist at all, e.g.
// to only offer "download again" for orphaned tracks with nowhere to re-link.
function computeLibraryIdsInPlaylists(playlistDataList) {
  const ids = new Set();
  for (const data of playlistDataList) {
    for (const t of data.tracks) {
      if (t.music_ID) ids.add(t.music_ID);
    }
  }
  return ids;
}

module.exports = { slugify, buildLibraryIndexes, trackVideoId, reconcilePlaylistTracks, computeLibraryIdsInPlaylists };
