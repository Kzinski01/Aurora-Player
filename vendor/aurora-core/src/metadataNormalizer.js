// Normalizes yt-dlp's raw `-J` JSON output into the shape the rest of the
// app (desktop and mobile alike) actually consumes. Pure — no fs/process,
// just object transformation, so both platforms parse yt-dlp's stdout their
// own way (child_process on desktop, ProcessBuilder on mobile) and hand the
// resulting JSON string to `JSON.parse` + this function.
function normalizeMetadata(info) {
  const formats = (info.formats || [])
    .filter((f) => f.vcodec !== "none")
    .map((f) => f.height)
    .filter(Boolean);
  const resolutions = [...new Set(formats)].sort((a, b) => b - a);
  return {
    id: info.id,
    // The real watch URL — a search result's caller-supplied "url" is the
    // "ytsearch1:query" pseudo-url, which isn't downloadable/matchable on
    // its own, so the resolved link is what actually gets stored/used.
    url: info.webpage_url || info.original_url || info.url || null,
    title: info.title,
    uploader: info.uploader || info.channel || "",
    thumbnail: info.thumbnail,
    duration: info.duration,
    uploadDate: info.upload_date,
    description: info.description,
    resolutions,
    isPlaylist: info._type === "playlist",
    entries: info._type === "playlist" ? (info.entries || []).length : null,
  };
}

// Unwraps yt-dlp's "-J ytsearch1:<query>" playlist envelope down to the
// resolved video's own info object, or throws if the search found nothing.
// Shared because both platforms feed a bare search query through the exact
// same "ytsearch1:" pseudo-url path.
function unwrapSearchResult(info) {
  if (info._type !== "playlist") return info;
  if (!Array.isArray(info.entries) || info.entries.length === 0) {
    throw new Error("Nenhum resultado encontrado.");
  }
  return info.entries[0];
}

module.exports = { normalizeMetadata, unwrapSearchResult };
