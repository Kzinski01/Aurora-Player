const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");
const { slugify, extractVideoId, reconcilePlaylistTracks, computeLibraryIdsInPlaylists, buildLibraryIndexes, trackVideoId } = require("aurora-core");
const log = require("./logger");
const { loadLibrary, annotateLibrary } = require("./libraryStore");

function playlistsDir() {
  const dir = path.join(app.getPath("userData"), "Playlists");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Picks a filename that doesn't clash with an existing file, so creating two
// playlists named the same doesn't overwrite one another on disk.
function uniqueFileName(dir, slug) {
  let file = `${slug}.json`;
  let n = 2;
  while (fs.existsSync(path.join(dir, file))) {
    file = `${slug}-${n}.json`;
    n += 1;
  }
  return file;
}

// Every playlist the app manages is backed by a .json file in the Playlists
// folder — creating one here writes the file immediately, and every later
// mutation (rename/add/remove track) rewrites it. Internally a track is kept
// as minimal as possible: { id: position, music_ID: <library id> } once it's
// matched to a library entry — see syncFromDisk, which is what performs that
// normalization. A track not yet downloaded ("pending") keeps its raw
// title/url/mode/format instead, since there's no library id to point at yet.
function createPlaylistFile(name, tracks = []) {
  const dir = playlistsDir();
  const finalName = typeof name === "string" ? name.trim().slice(0, 100) || "Nova playlist" : "Nova playlist";
  const file = uniqueFileName(dir, slugify(finalName).slice(0, 100));
  const data = { id: crypto.randomUUID(), name: finalName, tracks };
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2), "utf8");
  return { file, data };
}

function readPlaylistFile(file) {
  const full = playlistPath(file);
  if (fs.statSync(full).size > 8 * 1024 * 1024) throw new Error("A playlist ultrapassa 8 MB.");
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  validatePlaylist(data);
  return data;
}

function playlistPath(file) {
  if (typeof file !== "string" || !/^[^\\/\u0000]+\.json$/i.test(file) || file.includes(":")) throw new Error("Nome de arquivo de playlist inválido.");
  const full = path.join(playlistsDir(), file);
  if (fs.existsSync(full) && fs.lstatSync(full).isSymbolicLink()) throw new Error("A playlist precisa ser um arquivo, sem links para outra pasta.");
  return full;
}

function validatePlaylist(data) {
  if (!data || typeof data.id !== "string" || !data.id || data.id.length > 100 || typeof data.name !== "string" ||
    !data.name.trim() || data.name.length > 100 || !Array.isArray(data.tracks) || data.tracks.length > 10000 ||
    data.tracks.some((track) => !track || typeof track !== "object" || Array.isArray(track))) {
    throw new Error("A playlist precisa ter id, nome e uma lista de até 10.000 faixas.");
  }
}

function writePlaylistFile(file, data) {
  validatePlaylist(data);
  fs.writeFileSync(playlistPath(file), JSON.stringify(data, null, 2), "utf8");
}

function deletePlaylistFile(file) {
  const full = playlistPath(file);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function readPlaylistFiles() {
  const dir = playlistsDir();
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".json"));
  const results = [];
  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const data = readPlaylistFile(file);
      results.push({ file, data });
    } catch (e) {
      log.error("playlists", "falha ao ler arquivo de playlist", { file, message: e.message });
    }
  }
  return results;
}

// Raw membership check (ignores whether the library entry is still active) —
// used to tell whether a library item belongs to any playlist at all, e.g.
// to only offer "download again" for orphaned tracks with nowhere to re-link.
function getLibraryIdsInPlaylists() {
  return computeLibraryIdsInPlaylists(readPlaylistFiles().map(({ data }) => data));
}

// Combines the disk-existence check (annotateLibrary) with playlist
// membership — the one function every place that sends the library to the
// renderer should go through, so both flags stay consistent everywhere.
function annotateLibraryWithPlaylists(library) {
  const idsInPlaylists = getLibraryIdsInPlaylists();
  return annotateLibrary(library).map((i) => ({ ...i, inPlaylist: idsInPlaylists.has(i.id) }));
}

// A track's identity is its videoId — used to warn the user when a track
// they're adding to a playlist already sits in another one.
function findPlaylistsContainingVideoId(videoId, excludeFile) {
  if (!videoId) return [];
  const { byId: libraryById } = buildLibraryIndexes(loadLibrary());
  return readPlaylistFiles()
    .filter(({ file, data }) => file !== excludeFile && data.tracks.some((t) => trackVideoId(t, libraryById) === videoId))
    .map(({ data }) => data.name);
}

// Reconciles the *.json files in the Playlists folder against the library —
// the actual matching/dedup rules live in aurora-core's reconcilePlaylistTracks
// (shared with mobile); this just wires disk I/O around it: read every file,
// run the reconciliation, rewrite the ones that changed.
function syncFromDisk() {
  const library = loadLibrary();
  const filePlaylists = readPlaylistFiles();
  const syncedPlaylists = [];

  for (const { file, data } of filePlaylists) {
    const { tracks, normalized, changed } = reconcilePlaylistTracks(data.tracks, library, fs.existsSync);

    if (changed) writePlaylistFile(file, { ...data, tracks: normalized });

    syncedPlaylists.push({
      id: `file:${data.id}`,
      name: data.name,
      source: "file",
      sourceFile: file,
      tracks,
      trackIds: tracks.filter((t) => t.libraryId).map((t) => t.libraryId),
    });
  }

  log.info("playlists", "sincronização com a pasta Playlists concluída", {
    arquivos: filePlaylists.length,
    faixasFaltando: syncedPlaylists.reduce((n, p) => n + p.tracks.filter((t) => !t.libraryId).length, 0),
  });
  return syncedPlaylists;
}

module.exports = {
  playlistsDir,
  syncFromDisk,
  extractVideoId,
  slugify,
  createPlaylistFile,
  readPlaylistFile,
  writePlaylistFile,
  deletePlaylistFile,
  findPlaylistsContainingVideoId,
  getLibraryIdsInPlaylists,
  annotateLibraryWithPlaylists,
};
