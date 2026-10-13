const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aurora", {
  fetchMetadata: (url) => ipcRenderer.invoke("metadata:fetch", url),
  addDownload: (payload) => ipcRenderer.invoke("download:add", payload),
  listDownloads: () => ipcRenderer.invoke("download:list"),
  pauseDownload: (id) => ipcRenderer.invoke("download:pause", id),
  resumeDownload: (id) => ipcRenderer.invoke("download:resume", id),
  cancelDownload: (id) => ipcRenderer.invoke("download:cancel", id),
  removeDownload: (id) => ipcRenderer.invoke("download:remove", id),
  setConcurrency: (n) => ipcRenderer.invoke("download:setConcurrency", n),
  onDownloadUpdate: (cb) => {
    const listener = (_e, job) => cb(job);
    ipcRenderer.on("download:update", listener);
    return () => ipcRenderer.removeListener("download:update", listener);
  },
  addPlaylistDownload: (payload) => ipcRenderer.invoke("playlistDownload:add", payload),
  listPlaylistDownloads: () => ipcRenderer.invoke("playlistDownload:list"),
  cancelPlaylistDownload: (id) => ipcRenderer.invoke("playlistDownload:cancel", id),
  onPlaylistDownloadUpdate: (cb) => {
    const listener = (_e, group) => cb(group);
    ipcRenderer.on("playlistDownload:update", listener);
    return () => ipcRenderer.removeListener("playlistDownload:update", listener);
  },
  toFileUrl: (filePath) => ipcRenderer.invoke("fs:toFileUrl", filePath),
  toRawFileUrl: (filePath) => ipcRenderer.invoke("fs:toRawFileUrl", filePath),

  listPlaylists: () => ipcRenderer.invoke("playlist:list"),
  createPlaylist: (name) => ipcRenderer.invoke("playlist:create", name),
  renamePlaylist: (id, name) => ipcRenderer.invoke("playlist:rename", { id, name }),
  deletePlaylist: (id) => ipcRenderer.invoke("playlist:delete", id),
  togglePlaylistTrack: (playlistId, trackId) =>
    ipcRenderer.invoke("playlist:toggleTrack", { playlistId, trackId }),
  removePlaylistTrack: (playlistId, position) =>
    ipcRenderer.invoke("playlist:removeTrack", { playlistId, position }),
  addPlaylistTracks: (playlistId, trackIds) => ipcRenderer.invoke("playlist:addTracks", { playlistId, trackIds }),
  resyncPlaylists: () => ipcRenderer.invoke("playlists:resync"),
  openPlaylistsFolder: () => ipcRenderer.invoke("playlists:openFolder"),
  importPlaylists: () => ipcRenderer.invoke("playlists:import"),
  downloadMissingTracks: (playlistId) => ipcRenderer.invoke("playlists:downloadMissing", playlistId),
  exportPlaylist: (playlistId) => ipcRenderer.invoke("playlists:export", playlistId),
  onPlaylistsUpdate: (cb) => {
    const listener = (_e, playlists) => cb(playlists);
    ipcRenderer.on("playlists:update", listener);
    return () => ipcRenderer.removeListener("playlists:update", listener);
  },

  listLibrary: () => ipcRenderer.invoke("library:list"),
  removeFromLibrary: (id) => ipcRenderer.invoke("library:remove", id),
  restoreLibraryItem: (id) => ipcRenderer.invoke("library:restore", id),
  purgeLibraryItem: (id) => ipcRenderer.invoke("library:purge", id),
  redownloadLibraryItem: (id) => ipcRenderer.invoke("library:redownload", id),
  toggleFavorite: (id) => ipcRenderer.invoke("library:toggleFavorite", id),
  onLibraryUpdate: (cb) => {
    const listener = (_e, library) => cb(library);
    ipcRenderer.on("library:update", listener);
    return () => ipcRenderer.removeListener("library:update", listener);
  },
  getLibraryStats: () => ipcRenderer.invoke("library:stats"),

  getProfile: () => ipcRenderer.invoke("profile:get"),
  setProfileUsername: (username) => ipcRenderer.invoke("profile:setUsername", username),
  setProfilePreferences: (patch) => ipcRenderer.invoke("profile:setPreferences", patch),
  pickProfileAvatar: () => ipcRenderer.invoke("profile:pickAvatar"),
  getProfileAvatarUrl: () => ipcRenderer.invoke("profile:avatarUrl"),
  exportProfile: () => ipcRenderer.invoke("profile:export"),
  pickProfileImport: () => ipcRenderer.invoke("profile:pickImport"),
  applyProfileImport: (payload) => ipcRenderer.invoke("profile:applyImport", payload),

  probeMedia: (filePath) => ipcRenderer.invoke("editor:probe", filePath),
  exportClip: (payload) => ipcRenderer.invoke("editor:export", payload),
  cancelClipExport: () => ipcRenderer.invoke("editor:cancel"),
  onClipProgress: (cb) => {
    const listener = (_e, progress) => cb(progress);
    ipcRenderer.on("editor:progress", listener);
    return () => ipcRenderer.removeListener("editor:progress", listener);
  },

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),

  updateDiscordActivity: (activity) => ipcRenderer.invoke("discord:updateActivity", activity),
  clearDiscordActivity: () => ipcRenderer.invoke("discord:clearActivity"),

  checkDependencyVersions: () => ipcRenderer.invoke("deps:check"),
  updateYtDlp: () => ipcRenderer.invoke("deps:updateYtDlp"),
  chooseFfmpeg: () => ipcRenderer.invoke("deps:chooseFfmpeg"),
  resetFfmpeg: () => ipcRenderer.invoke("deps:resetFfmpeg"),
  chooseFolder: () => ipcRenderer.invoke("dialog:chooseFolder"),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  focusApp: () => ipcRenderer.invoke("app:focus"),

  log: (level, message, meta) => ipcRenderer.invoke("renderer:log", { level, message, meta }),
  openLogsFolder: () => ipcRenderer.invoke("logs:openFolder"),

  // --- Mini player -------------------------------------------------------
  // The same bridge is loaded into both windows, so both halves of the link
  // live here. Playback stays in the main window: it *publishes* state and
  // *receives* commands, while the mini player does the mirror image.
  publishMiniState: (state) => ipcRenderer.send("mini:publishState", state),
  publishMiniSpectrum: (bars) => ipcRenderer.send("mini:publishSpectrum", bars),
  onMiniCommand: (cb) => {
    const listener = (_e, command) => cb(command);
    ipcRenderer.on("mini:command", listener);
    return () => ipcRenderer.removeListener("mini:command", listener);
  },
  onMiniVisibility: (cb) => {
    const listener = (_e, visible) => cb(visible);
    ipcRenderer.on("mini:visibility", listener);
    return () => ipcRenderer.removeListener("mini:visibility", listener);
  },

  sendMiniCommand: (command) => ipcRenderer.send("mini:sendCommand", command),
  onMiniState: (cb) => {
    const listener = (_e, state) => cb(state);
    ipcRenderer.on("mini:state", listener);
    return () => ipcRenderer.removeListener("mini:state", listener);
  },
  onMiniSpectrum: (cb) => {
    const listener = (_e, bars) => cb(bars);
    ipcRenderer.on("mini:spectrum", listener);
    return () => ipcRenderer.removeListener("mini:spectrum", listener);
  },
  // Whether the main window is actually on screen. Needed because a hidden
  // window with backgroundThrottling disabled still reports itself as visible.
  onWindowVisibility: (cb) => {
    const listener = (_e, visible) => cb(visible);
    ipcRenderer.on("window:visibility", listener);
    return () => ipcRenderer.removeListener("window:visibility", listener);
  },

  restoreMainWindow: () => ipcRenderer.invoke("mini:restoreMain"),
  closeMiniPlayer: () => ipcRenderer.invoke("mini:close"),
});
