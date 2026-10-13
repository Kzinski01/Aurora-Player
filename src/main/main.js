const { app, BrowserWindow, ipcMain, dialog, shell, session } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const Store = require("electron-store");
const { DownloadManager } = require("./downloadManager");
const { checkDependencyVersions, updateYtDlp, configureFfmpegPath, validateFfmpegPath } = require("./binaries");
const discordPresence = require("./discordPresence");
const miniPlayer = require("./miniPlayer");
const mediaEditor = require("./mediaEditor");
const tray = require("./tray");
const mediaProtocol = require("./mediaProtocol");
const log = require("./logger");
const { trustWindow, isTrustedSender, assertTrustedSender } = require("./windowSecurity");
const { validatePreferences } = require("./profileValidation");
const { safeFileName } = require("./downloadInput");
const { configureSession } = require("./sessionSecurity");
const {
  playlistsDir,
  syncFromDisk,
  extractVideoId,
  createPlaylistFile,
  readPlaylistFile,
  writePlaylistFile,
  deletePlaylistFile,
  findPlaylistsContainingVideoId,
  annotateLibraryWithPlaylists,
} = require("./playlistSync");
const { libraryFile, loadLibrary, saveLibrary, libraryReadError } = require("./libraryStore");
const {
  loadProfile,
  saveProfile,
  touchLastAccess,
  setAvatarFromPath,
  avatarPath,
  buildExportPayload,
  readImportPayload,
  applyImportPayload,
} = require("./profileStore");

process.on("uncaughtException", (err) => {
  log.error("main", "uncaughtException", { message: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  log.error("main", "unhandledRejection", { reason: reason?.stack || String(reason) });
});

// Os testes usam uma pasta temporária própria e mídia gerada pelo FFmpeg.
const testUserData = process.env.AURORA_E2E_USER_DATA;
const testDirectory = path.join(app.getAppPath(), "output");
if (!app.isPackaged && testUserData && path.dirname(path.resolve(testUserData)) === path.resolve(testDirectory) && path.basename(testUserData).startsWith("aurora-e2e-")) {
  app.setPath("userData", path.resolve(testUserData));
}

let store;
try {
  store = new Store({
    defaults: {
      downloadDir: path.join(app.getPath("downloads"), "Aurora"),
      maxConcurrent: 3,
      theme: "system",
      language: "pt-BR",
      discordRichPresence: false,
      volume: 0.8,
      ffmpegPath: null,
    },
  });
} catch (err) {
  log.error("store", "Falha ao abrir o armazenamento persistente (arquivo de config pode estar corrompido)", {
    message: err.message,
    stack: err.stack,
  });
  throw err;
}
configureFfmpegPath(store.get("ffmpegPath"));

let mainWindow;
let splashWindow;
let downloadManager;
let chosenDownloadDir = null;
const downloadingPlaylists = new Set();

// Closing the main window hides it instead of quitting (see createWindow), so
// something has to distinguish "user closed the window" from "the app is
// genuinely shutting down" — otherwise the close handler would veto the quit
// and the process would never exit.
let isQuitting = false;

// The media protocol has to be declared privileged before "ready", which is
// earlier than any of the setup below runs.
mediaProtocol.registerScheme();

// Backs the "Play on Aurora Player" button on the Discord presence card:
// Discord buttons can only open a URL, so the app registers a scheme of its
// own and treats any aurora:// link as "bring my window to the front".
const APP_PROTOCOL = "aurora";

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  // focus() alone is a no-op on a minimized window, which is the state the
  // app is most likely in when someone clicks the button from Discord.
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  // The two are alternatives, never both on screen at once: the mini player
  // exists precisely for when the main window isn't there.
  miniPlayer.hide();
  tray.refresh();
  return true;
}

// Windows hands a protocol link to a *new* process rather than the running
// one, so without the single-instance lock clicking the Discord button would
// launch a second Aurora instead of surfacing the one already playing.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => focusMainWindow());
  // macOS delivers the same thing through an event instead of argv.
  app.on("open-url", (event) => {
    event.preventDefault();
    focusMainWindow();
  });
}

// The intro video plays while the app loads in the background — main window
// only appears once BOTH the video has finished AND the renderer is ready,
// so the intro is never cut short by a fast boot, but also never blocks
// startup indefinitely if playback fails (see the timeout below).
let introDone = false;
let appReadyToShow = false;

function maybeShowMainWindow() {
  if (!introDone || !appReadyToShow) return;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
}

function createSplash() {
  // 16:9 to match the intro video, roughly matched to a comfortable on-screen size.
  splashWindow = new BrowserWindow({
    width: 480,
    height: 270,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#0B0C12",
    icon: path.join(__dirname, "..", "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "splashPreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  trustWindow(splashWindow, path.join(__dirname, "splash.html"), "splash");
  splashWindow.loadFile(path.join(__dirname, "splash.html"));

  const onIntroEnded = (event) => {
    if (!isTrustedSender(event, ["splash"])) return;
    ipcMain.removeListener("splash:intro-ended", onIntroEnded);
    log.info("main", "intro finalizado, liberando janela principal");
    introDone = true;
    maybeShowMainWindow();
  };
  ipcMain.on("splash:intro-ended", onIntroEnded);
  // Safety net: never block startup forever if the video can't play for some
  // reason (codec issue, missing file) — the video is ~10s, so this is a
  // generous ceiling that only kicks in when something's actually wrong.
  setTimeout(() => {
    if (introDone) return;
    log.warn("main", "intro não sinalizou o fim a tempo. Liberando janela principal pelo tempo limite");
    introDone = true;
    maybeShowMainWindow();
  }, 12000);
}

// Wraps ipcMain.handle: logs every call, its result/error, so bugs are traceable in aurora.log.
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      assertTrustedSender(event, ["mini:restoreMain", "mini:close", "renderer:log"].includes(channel) ? ["main", "mini"] : ["main"]);
      const result = await fn(event, ...args);
      log.info("ipc", channel, { args, resultSummary: summarize(result) });
      return result;
    } catch (err) {
      log.error("ipc", `${channel} falhou`, { args, message: err.message, stack: err.stack });
      throw err;
    }
  });
}

function summarize(result) {
  if (Array.isArray(result)) return `array(${result.length})`;
  if (result && typeof result === "object") return Object.keys(result);
  return result;
}

function createWindow() {
  // Shown for the instant between the window opening and the renderer's own
  // CSS painting — matching the saved theme here avoids a dark flash under
  // the light theme (and vice versa) on every launch.
  const windowBackgroundColor = store.get("theme") === "light" ? "#FAF9FD" : "#0B0C12";
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: windowBackgroundColor,
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "..", "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // This window keeps owning playback while hidden behind the mini player,
      // and Chromium otherwise clamps timers in a window that isn't visible —
      // which would stall the progress ticks and the spectrum feed.
      backgroundThrottling: false,
    },
  });

  // Closing is "put Aurora away", not "quit": downloads in flight and the
  // current track keep running, the tray icon stays as the way back in, and
  // the mini player takes over as the visible surface.
  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    miniPlayer.show();
    tray.refresh();
    log.info("main", "janela principal ocultada. App segue ativo na bandeja");
  });

  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    log.error("renderer", "render-process-gone", details);
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, description, url) => {
    log.error("renderer", "did-fail-load", { code, description, url });
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  const CONSOLE_LEVEL_WARNING = 2;
  mainWindow.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    if (level >= CONSOLE_LEVEL_WARNING) log.error("console", message, { line, sourceId });
  });

  // Keeps the window hidden until the renderer has actually painted, so the
  // splash screen covers the Vite boot/store hydration instead of a blank
  // frame — and, combined with introDone, until the intro video finishes.
  mainWindow.once("ready-to-show", () => {
    appReadyToShow = true;
    maybeShowMainWindow();
  });

  // backgroundThrottling:false (above) is what keeps playback and the spectrum
  // alive while this window is hidden — but it keeps *animations* alive too,
  // and document.visibilityState stays "visible" for a hidden window, so the
  // renderer cannot tell on its own that nobody is looking. Without this, the
  // per-pixel WebGL background carries on rendering at full refresh rate behind
  // the mini player, for no one.
  const publishVisibility = (visible) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("window:visibility", visible);
  };
  mainWindow.on("show", () => publishVisibility(true));
  mainWindow.on("hide", () => publishVisibility(false));

  trustWindow(mainWindow, path.join(__dirname, "..", "renderer", "dist", "index.html"), "main");
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "dist", "index.html"));
  downloadManager = new DownloadManager(mainWindow, store);
}

// config.json (electron-store) used to hold the library and a cached copy of
// playlists too — it's now reserved for app settings only. The library moves
// to its own file (Biblioteca/library.json); playlists were already file-backed
// and just stop being mirrored into config.json.
function migrateStoreToFiles() {
  if (!fs.existsSync(libraryFile()) && store.has("library")) {
    const legacy = store.get("library", []);
    saveLibrary(legacy);
    log.info("library", "biblioteca migrada de config.json para arquivo dedicado", { count: legacy.length, file: libraryFile() });
  }

  // Playlists created before every playlist became a file on disk only lived
  // in electron-store (trackIds pointing at library items) — without this
  // they'd simply disappear the first time syncFromDisk runs.
  const legacyPlaylists = store.get("playlists", []).filter((p) => !p.sourceFile);
  if (legacyPlaylists.length > 0) {
    const library = loadLibrary();
    for (const p of legacyPlaylists) {
      const tracks = (p.trackIds || [])
        .map((id) => library.find((l) => l.id === id))
        .filter(Boolean)
        .map((item, i) => ({ id: i + 1, music_ID: item.id }));
      createPlaylistFile(p.name, tracks);
    }
    log.info("playlists", "playlists antigas migradas para arquivos", { count: legacyPlaylists.length });
  }

  if (store.has("library")) store.delete("library");
  if (store.has("playlists")) store.delete("playlists");
}

// Total library size on disk, format breakdown, and the longest playlist —
// shared by the Biblioteca stats card and the Perfil page so both read the
// exact same numbers.
function computeLibraryStats() {
  const library = loadLibrary().filter((i) => !i.removed);
  let totalSizeBytes = 0;
  let existingCount = 0;
  // The library holds both audio and video downloads, so a single count can't
  // honestly be called "músicas" — these back the breakdown shown under it.
  let audioCount = 0;
  let videoCount = 0;
  const formatCounts = {};
  for (const item of library) {
    if (item.filePath && fs.existsSync(item.filePath)) {
      existingCount += 1;
      if (item.mode === "audio") audioCount += 1;
      else videoCount += 1;
      try {
        totalSizeBytes += fs.statSync(item.filePath).size;
      } catch (e) {
        log.warn("library", "falha ao ler tamanho do arquivo", { filePath: item.filePath, message: e.message });
      }
    }
    const fmt = (item.mode === "audio" ? item.format : "mp4")?.toUpperCase();
    if (fmt) formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
  }
  const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const playlists = syncFromDisk();
  const longestPlaylist = playlists.reduce(
    (best, p) => (p.tracks.length > (best?.trackCount ?? -1) ? { name: p.name, trackCount: p.tracks.length } : best),
    null
  );
  return { totalCount: existingCount, audioCount, videoCount, totalSizeBytes, topFormat, longestPlaylist, playlistCount: playlists.length };
}

// Looks up the on-disk file backing a playlist id (every playlist is
// file-backed now, created/renamed/edited here always rewrite that file).
function findPlaylistFile(playlistId) {
  const playlist = syncFromDisk().find((p) => p.id === playlistId);
  return playlist ? playlist.sourceFile : null;
}

// Applies a mutation to the library and persists it — extracted because
// library:remove/restore/purge/toggleFavorite were each hand-rolling the
// same load → mutate → save sequence with only the mutation itself differing.
function mutateLibrary(mutate) {
  const library = mutate(loadLibrary());
  saveLibrary(library);
  return library;
}

// Video/audio ids currently sitting in the library with a file that still
// exists on disk — the definition of "already downloaded" used when
// deciding whether a playlist track is genuinely missing.
function activeLibraryVideoIds() {
  return new Set(
    loadLibrary()
      .filter((i) => !i.removed && i.filePath && fs.existsSync(i.filePath))
      .map((i) => extractVideoId(i.url))
  );
}

// Queues a single missing playlist track for download, fetching its
// thumbnail first (tracks parsed from a playlist .json only ever have
// title/url — without this the job, and later the library entry, ends up
// with thumbnail: null). Respects the mode/format tagged on the entry
// instead of hardcoding audio/mp3, so a video added to a playlist doesn't
// come back as an mp3.
async function queueMissingTrack(track) {
  let thumbnail = null;
  try {
    const meta = await downloadManager.fetchMetadata(track.url);
    thumbnail = meta.thumbnail || null;
  } catch (e) {
    log.warn("playlists", "falha ao obter thumbnail da faixa antes do download", { url: track.url, message: e.message });
  }
  downloadManager.addJob({
    url: track.url,
    title: track.title,
    thumbnail,
    mode: track.mode === "video" ? "video" : "audio",
    resolution: track.mode === "video" ? track.format : null,
    audioFormat: track.mode === "video" ? null : track.format || "mp3",
    outputDir: store.get("downloadDir"),
  });
}

function registerDownloadHandlers() {
  handle("metadata:fetch", async (_e, url) => downloadManager.fetchMetadata(url));
  handle("download:add", async (_e, payload) => downloadManager.addJob(payload));
  handle("download:list", async () => downloadManager.list());
  handle("download:pause", async (_e, id) => downloadManager.pause(id));
  handle("download:resume", async (_e, id) => downloadManager.resume(id));
  handle("download:cancel", async (_e, id) => downloadManager.cancel(id));
  handle("download:remove", async (_e, id) => downloadManager.remove(id));
  handle("download:setConcurrency", async (_e, n) => downloadManager.setMaxConcurrent(n));
  handle("playlistDownload:add", async (_e, payload) => downloadManager.addPlaylist(payload));
  handle("playlistDownload:list", async () => downloadManager.listPlaylists());
  handle("playlistDownload:cancel", async (_e, id) => downloadManager.cancelPlaylist(id));
}

function registerLibraryHandlers() {
  handle("library:list", async () => annotateLibraryWithPlaylists(loadLibrary()));

  // Soft delete: keeps the entry (marked "removed") instead of dropping it, so
  // the UI can render it dimmed/identifiable as deleted rather than making it
  // vanish. It also stops counting toward playlist matching (see syncFromDisk).
  handle("library:remove", async (_e, id) => {
    const library = mutateLibrary((lib) =>
      lib.map((i) => (i.id === id ? { ...i, removed: true, removedAt: new Date().toISOString() } : i))
    );
    syncFromDisk();
    return annotateLibraryWithPlaylists(library);
  });
  handle("library:restore", async (_e, id) => {
    const library = mutateLibrary((lib) => lib.map((i) => (i.id === id ? { ...i, removed: false, removedAt: null } : i)));
    syncFromDisk();
    return annotateLibraryWithPlaylists(library);
  });
  handle("library:purge", async (_e, id) => {
    const library = mutateLibrary((lib) => lib.filter((i) => i.id !== id));
    syncFromDisk();
    return annotateLibraryWithPlaylists(library);
  });
  handle("library:toggleFavorite", async (_e, id) => {
    const library = mutateLibrary((lib) => lib.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)));
    return annotateLibraryWithPlaylists(library);
  });

  // Re-queues a removed/orphaned library entry's original url — completing
  // the download revives/updates the same library row (see
  // downloadManager._addToLibrary's videoId dedup), it never creates a
  // duplicate.
  handle("library:redownload", async (_e, id) => {
    const item = loadLibrary().find((i) => i.id === id);
    if (!item || !item.url) return { queued: false };
    downloadManager.addJob({
      url: item.url,
      title: item.title,
      thumbnail: item.thumbnail,
      mode: item.mode,
      resolution: item.mode === "video" ? item.resolution : null,
      audioFormat: item.mode === "audio" ? item.format : null,
      outputDir: store.get("downloadDir"),
    });
    log.info("library", "redownload solicitado para item removido/órfão", { id, title: item.title });
    return { queued: true };
  });

  handle("library:stats", async () => computeLibraryStats());
}

function registerProfileHandlers() {
  handle("profile:get", async () => loadProfile());
  handle("profile:setUsername", async (_e, username) => {
    if (typeof username !== "string") throw new Error("Digite um nome para o perfil.");
    const p = loadProfile();
    p.username = (username || "").trim().slice(0, 40) || "Usuário";
    saveProfile(p);
    return p;
  });
  handle("profile:setPreferences", async (_e, patch) => {
    validatePreferences(patch);
    const p = loadProfile();
    if (patch.theme) p.theme = patch.theme;
    if (patch.accentColor) p.accentColor = patch.accentColor;
    saveProfile(p);
    return p;
  });
  handle("profile:pickAvatar", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Escolher foto de perfil",
      filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }],
      properties: ["openFile"],
    });
    if (res.canceled || res.filePaths.length === 0) return loadProfile();
    const p = setAvatarFromPath(res.filePaths[0]);
    log.info("profile", "avatar atualizado", { avatarFile: p.avatarFile });
    return p;
  });
  handle("profile:avatarUrl", async () => {
    const full = avatarPath();
    return full ? pathToFileURL(full).href : null;
  });
  handle("profile:export", async () => {
    const payload = buildExportPayload();
    const res = await dialog.showSaveDialog(mainWindow, {
      title: "Exportar perfil",
      defaultPath: path.join(app.getPath("documents"), `${safeFileName(payload.profile.username, "aurora")}.auroraProfile`),
      filters: [{ name: "Perfil Aurora", extensions: ["auroraProfile"] }],
    });
    if (res.canceled || !res.filePath) return { path: null };
    fs.writeFileSync(res.filePath, JSON.stringify(payload), "utf8");
    log.info("profile", "perfil exportado", { path: res.filePath });
    return { path: res.filePath };
  });
  // Read-only preview — the renderer shows a confirmation before this is
  // actually applied (see profile:applyImport), since importing overwrites
  // the current profile.
  handle("profile:pickImport", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Importar perfil",
      filters: [{ name: "Perfil Aurora", extensions: ["auroraProfile"] }],
      properties: ["openFile"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    try {
      return readImportPayload(res.filePaths[0]);
    } catch (e) {
      log.error("profile", "falha ao ler arquivo de perfil", { message: e.message });
      throw e;
    }
  });
  handle("profile:applyImport", async (_e, payload) => {
    const p = applyImportPayload(payload);
    log.info("profile", "perfil importado", { id: p.id, username: p.username });
    return p;
  });
}

function registerPlaylistHandlers() {
  handle("playlist:list", async () => syncFromDisk());
  handle("playlist:create", async (_e, name) => {
    const { file } = createPlaylistFile(name);
    const playlists = syncFromDisk();
    // readdirSync order isn't creation order, so the new playlist isn't
    // reliably "last" in the synced list — return it explicitly by file match
    // instead of making callers guess its position.
    const playlist = playlists.find((p) => p.sourceFile === file) || null;
    return { playlist, playlists };
  });
  handle("playlist:rename", async (_e, { id, name }) => {
    const file = findPlaylistFile(id);
    if (!file) return syncFromDisk();
    const data = readPlaylistFile(file);
    data.name = name;
    writePlaylistFile(file, data);
    return syncFromDisk();
  });
  handle("playlist:delete", async (_e, id) => {
    const file = findPlaylistFile(id);
    if (file) deletePlaylistFile(file);
    return syncFromDisk();
  });
  handle("playlist:toggleTrack", async (_e, { playlistId, trackId }) => {
    const file = findPlaylistFile(playlistId);
    if (!file) return { playlists: syncFromDisk(), duplicateOf: [] };
    const item = loadLibrary().find((l) => l.id === trackId);
    if (!item) return { playlists: syncFromDisk(), duplicateOf: [] };

    const data = readPlaylistFile(file);
    const videoId = extractVideoId(item.url);
    const idx = data.tracks.findIndex((t) => (t.music_ID ? t.music_ID === item.id : extractVideoId(t.url) === videoId));
    let duplicateOf = [];
    if (idx !== -1) {
      data.tracks.splice(idx, 1);
    } else {
      // A track's identity is its videoId — check every other playlist file
      // before adding, so the user is told this song already lives elsewhere
      // instead of silently ending up with untracked duplicate references.
      duplicateOf = findPlaylistsContainingVideoId(videoId, file);
      // Adding from the library means we already have a matching library
      // entry — the file only needs the position plus a reference to it.
      const nextId = data.tracks.reduce((max, t) => Math.max(max, t.id ?? 0), 0) + 1;
      data.tracks.push({ id: nextId, music_ID: item.id });
    }
    writePlaylistFile(file, data);
    const playlists = syncFromDisk();
    if (duplicateOf.length > 0) {
      log.info("playlists", "faixa adicionada já existia em outra(s) playlist(s)", { title: item.title, duplicateOf });
    }
    return { playlists, duplicateOf, trackTitle: item.title };
  });
  // Strips one specific track out of a playlist file by position — the only
  // way to detach a track for good. Unlike toggleTrack (keyed off the
  // library item, so it can't reach a track whose library entry was removed
  // or purged), this matches on the track's own position, so it also cleans
  // up "ghost" entries left behind after a library removal — see the
  // reconcilePlaylistTracks isActive comment in aurora-core/playlistRules.js
  // for why removing a library item doesn't already do this by itself.
  handle("playlist:removeTrack", async (_e, { playlistId, position }) => {
    const file = findPlaylistFile(playlistId);
    if (!file) return syncFromDisk();
    const data = readPlaylistFile(file);
    data.tracks = data.tracks.filter((t) => t.id !== position);
    writePlaylistFile(file, data);
    return syncFromDisk();
  });
  // Bulk variant used by the library's multi-select "add to playlist" flow —
  // writes the file once instead of once per track.
  handle("playlist:addTracks", async (_e, { playlistId, trackIds }) => {
    const file = findPlaylistFile(playlistId);
    if (!file) return { added: 0, playlists: syncFromDisk(), duplicates: [] };

    const library = loadLibrary();
    const data = readPlaylistFile(file);
    const existingIds = new Set(data.tracks.map((t) => t.music_ID).filter(Boolean));
    let nextId = data.tracks.reduce((max, t) => Math.max(max, t.id ?? 0), 0) + 1;
    let added = 0;
    const duplicates = [];
    for (const trackId of trackIds) {
      const item = library.find((l) => l.id === trackId);
      if (!item || existingIds.has(item.id)) continue;

      const foundIn = findPlaylistsContainingVideoId(extractVideoId(item.url), file);
      if (foundIn.length > 0) duplicates.push({ title: item.title, playlists: foundIn });

      data.tracks.push({ id: nextId++, music_ID: item.id });
      existingIds.add(item.id);
      added += 1;
    }
    writePlaylistFile(file, data);
    const playlists = syncFromDisk();
    log.info("playlists", "faixas adicionadas em lote", { playlistId, requested: trackIds.length, added, duplicates: duplicates.length });
    return { added, playlists, duplicates };
  });

  handle("playlists:resync", async () => syncFromDisk());
  handle("playlists:openFolder", async () => shell.openPath(playlistsDir()));
  handle("playlists:import", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Importar playlist",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile", "multiSelections"],
    });
    if (res.canceled || res.filePaths.length === 0) {
      return { imported: 0, playlists: syncFromDisk() };
    }

    let imported = 0;
    for (const src of res.filePaths) {
      try {
        if (fs.statSync(src).size > 8 * 1024 * 1024) throw new Error("A playlist ultrapassa 8 MB.");
        const data = JSON.parse(fs.readFileSync(src, "utf8"));
        if (typeof data.name !== "string" || !data.name.trim() || !Array.isArray(data.tracks) || data.tracks.length > 10000 || data.tracks.some((track) => !track || typeof track !== "object" || Array.isArray(track))) {
          log.warn("playlists", "arquivo selecionado ignorado (formato inválido)", { src });
          continue;
        }
        createPlaylistFile(data.name, data.tracks);
        imported += 1;
      } catch (e) {
        log.error("playlists", "falha ao importar arquivo de playlist", { src, message: e.message });
      }
    }

    const playlists = syncFromDisk();
    log.info("playlists", "importação de playlists concluída", { imported });
    return { imported, playlists };
  });
  handle("playlists:downloadMissing", async (_e, playlistId) => {
    // Guards against the "clicked the button several times" race: without
    // this, several overlapping IPC calls each read the same "missing" list
    // before any job lands in the library, and each one queues its own copy.
    if (downloadingPlaylists.has(playlistId)) {
      log.warn("playlists", "download de faixas faltantes ignorado (já em andamento)", { playlistId });
      return { queued: 0, alreadyLinked: 0, inProgress: true };
    }
    downloadingPlaylists.add(playlistId);
    try {
      const playlist = syncFromDisk().find((p) => p.id === playlistId);
      if (!playlist) return { queued: 0, alreadyLinked: 0 };
      const missing = (playlist.tracks || []).filter((t) => !t.libraryId);

      // A track can show as "missing" here (its own playlist entry was never
      // matched) while actually already sitting in the library under a
      // different videoId match timing — re-checking here instead of blindly
      // queueing avoids ending up with duplicate library entries for the same
      // song when it was downloaded via another playlist.
      const libraryVideoIds = activeLibraryVideoIds();

      let queued = 0;
      let alreadyLinked = 0;
      for (const t of missing) {
        if (libraryVideoIds.has(extractVideoId(t.url))) {
          alreadyLinked += 1;
          continue;
        }
        await queueMissingTrack(t);
        queued += 1;
      }
      if (alreadyLinked > 0) syncFromDisk();
      log.info("playlists", "download de faixas faltantes solicitado", { playlistId, queued, alreadyLinked });
      return { queued, alreadyLinked };
    } finally {
      downloadingPlaylists.delete(playlistId);
    }
  });

  handle("playlists:export", async (_e, playlistId) => {
    const playlist = syncFromDisk().find((p) => p.id === playlistId);
    if (!playlist) return { path: null };

    // Export is the one place tracks are fully denormalized (id/title/url/
    // mode/format) — everything another app instance (or this one, on
    // import) needs to check "is this the same song" by id, name or link,
    // without having to already share the same library.json.
    const tracks = playlist.tracks.map((t) => ({ id: t.position, title: t.title, url: t.url, mode: t.mode, format: t.format }));

    const exportId = playlist.id.replace(/^file:/, "");
    const json = JSON.stringify({ id: exportId, name: playlist.name, tracks }, null, 2);

    const slug = playlist.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "playlist";

    const res = await dialog.showSaveDialog(mainWindow, {
      title: "Exportar playlist",
      defaultPath: path.join(playlistsDir(), `${slug}.json`),
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled || !res.filePath) return { path: null };

    fs.writeFileSync(res.filePath, json, "utf8");
    log.info("playlists", "playlist exportada", { playlistId, path: res.filePath, tracks: tracks.length });
    return { path: res.filePath };
  });
}

function registerSettingsHandlers() {
  handle("settings:get", async () => store.store);
  handle("settings:set", async (_e, patch) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Configurações inválidas.");
    const allowed = new Set(["downloadDir", "theme", "language", "discordRichPresence", "volume"]);
    for (const [key, value] of Object.entries(patch)) {
      if (!allowed.has(key)) throw new Error("Configuração desconhecida.");
      if (key === "downloadDir" && (typeof value !== "string" || (value !== chosenDownloadDir && value !== store.get("downloadDir")))) throw new Error("Escolha a pasta pelo seletor.");
      if (key === "theme" && !["light", "dark", "system"].includes(value)) throw new Error("Tema inválido.");
      if (key === "language" && !["pt-BR", "en", "es", "de", "ja", "zh", "ru"].includes(value)) throw new Error("Idioma inválido.");
      if (key === "discordRichPresence" && typeof value !== "boolean") throw new Error("Preferência inválida.");
      if (key === "volume" && (!Number.isFinite(value) || value < 0 || value > 1)) throw new Error("Volume inválido.");
    }
    for (const [k, v] of Object.entries(patch)) store.set(k, v);
    chosenDownloadDir = null;
    if ("discordRichPresence" in patch) await discordPresence.setEnabled(patch.discordRichPresence);
    return store.store;
  });

  handle("discord:updateActivity", async (_e, activity) => discordPresence.setActivity(activity));
  handle("discord:clearActivity", async () => discordPresence.clearActivity());

  handle("deps:check", async () => checkDependencyVersions());
  handle("deps:updateYtDlp", async () => {
    const version = await updateYtDlp();
    log.info("deps", "yt-dlp atualizado manualmente", { version });
    return { version };
  });
  handle("deps:chooseFfmpeg", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "FFmpeg", extensions: ["exe"] }],
    });
    if (res.canceled || !res.filePaths[0]) return store.get("ffmpegPath");
    const selected = await validateFfmpegPath(res.filePaths[0]);
    store.set("ffmpegPath", selected);
    configureFfmpegPath(selected);
    return selected;
  });
  handle("deps:resetFfmpeg", async () => {
    store.set("ffmpegPath", null);
    configureFfmpegPath(null);
    return null;
  });
}

function registerEditorHandlers() {
  handle("editor:probe", async (_e, filePath) => {
    if (typeof filePath !== "string" || !fs.existsSync(filePath)) throw new Error("Arquivo não encontrado.");
    if (!mediaProtocol.isLibraryMediaPath(filePath)) throw new Error("Arquivo fora da biblioteca.");
    return mediaEditor.probe(filePath);
  });

  handle("editor:export", async (event, payload) => {
    if (!payload || typeof payload.filePath !== "string" || !fs.existsSync(payload.filePath)) throw new Error("Arquivo de origem não encontrado.");
    if (!payload || !mediaProtocol.isLibraryMediaPath(payload.filePath)) throw new Error("Arquivo fora da biblioteca.");
    const result = await mediaEditor.exportClip({
      ...payload,
      outputDir: store.get("downloadDir"),
      // Progress goes back as an event rather than as the promise's value:
      // invoke() resolves once, at the end, which is exactly when a progress
      // bar has stopped being useful.
      onProgress: (progress) => event.sender.send("editor:progress", progress),
    });
    return result;
  });

  handle("editor:cancel", async () => mediaEditor.cancelAll());
}

function registerMiniPlayerHandlers() {
  // Main window -> mini player. Both are fire-and-forget: a state push that
  // lands while the mini player is hidden is simply cached for the next show().
  ipcMain.on("mini:publishState", (event, state) => {
    if (isTrustedSender(event) && state && typeof state === "object") miniPlayer.pushState(state);
  });
  ipcMain.on("mini:publishSpectrum", (event, bars) => {
    if (isTrustedSender(event) && (bars === null || (Array.isArray(bars) && bars.length <= 128 && bars.every((bar) => Number.isFinite(bar) && bar >= 0 && bar <= 1)))) miniPlayer.pushSpectrum(bars);
  });

  // Mini player -> main window.
  ipcMain.on("mini:sendCommand", (event, command) => {
    if (!isTrustedSender(event, ["mini"]) || !command || !["toggle", "next", "prev", "seek", "shuffle", "favorite"].includes(command.action)) return;
    if (command.action === "seek" && (!Number.isFinite(command.value) || command.value < 0)) return;
    miniPlayer.forwardCommand({ action: command.action, value: command.value });
  });

  handle("mini:restoreMain", async () => focusMainWindow());
  handle("mini:close", async () => {
    miniPlayer.hide();
    tray.refresh();
    return true;
  });
}

function registerMiscHandlers() {
  // Served over the app's own scheme rather than file:// so WebAudio can read
  // the stream for the mini player's spectrum — see mediaProtocol.js.
  handle("fs:toFileUrl", async (_e, filePath) => {
    if (!mediaProtocol.isLibraryMediaPath(filePath)) throw new Error("Arquivo fora da biblioteca.");
    return mediaProtocol.toMediaUrl(filePath);
  });
  // Escape hatch used by the player when the custom scheme fails to load, so a
  // problem with the protocol costs the visualizer, never playback itself.
  handle("fs:toRawFileUrl", async (_e, filePath) => {
    if (!mediaProtocol.isLibraryMediaPath(filePath)) throw new Error("Arquivo fora da biblioteca.");
    return pathToFileURL(filePath).href;
  });

  handle("dialog:chooseFolder", async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"] });
    if (res.canceled || res.filePaths.length === 0) return null;
    chosenDownloadDir = res.filePaths[0];
    return chosenDownloadDir;
  });

  handle("app:focus", async () => focusMainWindow());

  handle("shell:openPath", async (_e, targetPath) => {
    if (typeof targetPath !== "string" || !path.isAbsolute(targetPath)) throw new Error("Caminho inválido.");
    const target = path.resolve(targetPath).toLowerCase();
    const folders = [store.get("downloadDir"), ...loadLibrary().map((item) => typeof item.filePath === "string" && path.dirname(item.filePath)), ...downloadManager.list().map((job) => job.outputDir)]
      .filter(Boolean).map((folder) => path.resolve(folder).toLowerCase());
    const withinDownloadDir = target.startsWith(path.resolve(store.get("downloadDir")).toLowerCase() + path.sep);
    const mediaFile = withinDownloadDir && /\.(mp3|m4a|aac|flac|wav|opus|ogg|mp4|webm|mkv|gif|webp)$/.test(target);
    if (!folders.includes(target) && !mediaFile) throw new Error("Caminho fora dos downloads e da biblioteca.");
    return shell.openPath(targetPath);
  });
  handle("logs:openFolder", async () => shell.openPath(log.logDir()));
  handle("renderer:log", async (_e, { level, message, meta }) => {
    if (!["info", "warn", "error", "debug", "critical"].includes(level) || typeof message !== "string") throw new Error("Mensagem de log inválida.");
    (log[level] || log.info)("renderer", message, meta);
  });
}

app.whenReady().then(() => {
  // A second instance launched by a protocol link has already handed the URL
  // to the running app and is on its way out — it must not build a UI or take
  // over the single-writer files (library, playlists) on the way.
  if (!hasSingleInstanceLock) return;
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(permission === "clipboard-read" && contents === mainWindow?.webContents);
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission) => permission === "clipboard-read" && contents === mainWindow?.webContents);
  configureSession(session.defaultSession, { root: app.getAppPath(), avatarPath, isLibraryMediaPath: mediaProtocol.isLibraryMediaPath });

  mediaProtocol.registerProtocolHandler();
  loadLibrary();
  if (libraryReadError()) {
    dialog.showErrorBox("Biblioteca do Aurora", "O arquivo da biblioteca está corrompido. Ele foi preservado; novos downloads não serão gravados na biblioteca até você restaurá-lo.");
  } else migrateStoreToFiles();
  syncFromDisk();
  touchLastAccess();
  createSplash();

  log.info("main", "app pronto", {
    storePath: store.path,
    libraryCount: loadLibrary().length,
    playlistsDir: playlistsDir(),
    libraryFile: libraryFile(),
    downloadDir: store.get("downloadDir"),
    logFile: log.logFilePath(),
  });

  if (process.platform === "win32") {
    app.setAppUserModelId("com.aurora.downloader");
  }

  // In a packaged build the executable itself is the handler; running from
  // source, Windows has to be told to launch electron.exe *with the project
  // path* or the registered command would open a bare Electron shell.
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL);
  } else {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }

  createWindow();

  miniPlayer.init({ store, getMainWindow: () => mainWindow });
  tray.create({
    store,
    isMiniVisible: () => miniPlayer.isVisible(),
    onOpenMain: () => focusMainWindow(),
    onToggleMini: () => {
      if (miniPlayer.isVisible()) miniPlayer.hide();
      else miniPlayer.show();
      tray.refresh();
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  registerDownloadHandlers();
  registerLibraryHandlers();
  registerProfileHandlers();
  registerPlaylistHandlers();
  registerSettingsHandlers();
  registerEditorHandlers();
  registerMiniPlayerHandlers();
  registerMiscHandlers();

  discordPresence.setEnabled(store.get("discordRichPresence"));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Neither window is ever really closed now (the main one hides, the mini one
// hides), so this only fires on a genuine shutdown — but it stays as the
// safety net for the case where something destroys both windows.
app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
  isQuitting = true;
  app.quit();
});

// Runs on every exit path — tray "Sair", window-all-closed, OS shutdown —
// which is where the teardown belongs now that quitting is no longer tied to
// closing a window. Closing the RPC pipe here means Discord drops the presence
// immediately instead of showing a stale "ouvindo" card until it times out.
let teardownDone = false;
app.on("before-quit", async (event) => {
  isQuitting = true;
  if (teardownDone) return;
  // disconnect() is async and Electron does not await this handler, so the
  // quit is vetoed once and re-issued after the pipe is actually closed.
  event.preventDefault();
  teardownDone = true;
  downloadManager?.shutdown();
  mediaEditor.cancelAll();
  try {
    await discordPresence.disconnect();
  } catch (e) {
    log.warn("main", "falha ao encerrar a conexão com o Discord", { message: e.message });
  }
  tray.destroy();
  miniPlayer.destroy();
  app.quit();
});
