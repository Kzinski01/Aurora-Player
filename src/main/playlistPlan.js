const { validateMediaUrl, safeThumbnailUrl, playlistOutputDir } = require("./downloadInput");

function entryUrl(entry, sourceUrl) {
  // Prefer a stable item page when provided. Some extractors, however, repeat
  // the collection page as webpage_url for every item; then use the item URL.
  for (const candidate of [entry?.webpage_url, entry?.url]) {
    if (typeof candidate !== "string") continue;
    if (/^[\w-]{11}$/.test(candidate) && /(?:youtube\.com|youtu\.be)/i.test(sourceUrl)) {
      return `https://www.youtube.com/watch?v=${candidate}`;
    }
    try {
      const url = validateMediaUrl(candidate);
      // Some extractors use the collection page as every entry's webpage_url.
      if (url !== sourceUrl) return url;
    } catch {
      // Try the other extractor-provided item URL before marking it unavailable.
    }
  }
  return null;
}

function playlistMetadata(info, sourceUrl) {
  const raw = Array.isArray(info.entries) ? info.entries : [];
  const entries = raw.map((entry, position) => ({
    position: position + 1,
    title: entry?.title || `Item ${position + 1}`,
    url: entryUrl(entry, sourceUrl),
    thumbnail: safeThumbnailUrl(entry?.thumbnail || entry?.thumbnails?.at(-1)?.url),
  }));
  return {
    id: info.id || sourceUrl,
    url: sourceUrl,
    title: info.title || "Playlist",
    uploader: info.uploader || info.channel || "",
    thumbnail: safeThumbnailUrl(info.thumbnail) || entries.find((item) => item.thumbnail)?.thumbnail || null,
    isPlaylist: true,
    entries: entries.length,
    items: entries,
    resolutions: [],
  };
}

function playlistJobFields(group, item) {
  return {
    url: item.url,
    title: item.title,
    thumbnail: item.thumbnail,
    mode: group.mode,
    resolution: group.resolution,
    audioFormat: group.audioFormat,
    outputDir: playlistOutputDir(group.outputDir, group.title),
  };
}

module.exports = { playlistMetadata, playlistJobFields, entryUrl };
