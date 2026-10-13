// Thin, safe wrapper around the window.aurora bridge exposed by preload.js.
// Falls back to no-ops when running outside Electron (e.g. `vite` in a plain browser tab).
const noop = async () => {};
const noopUnsub = () => {};

const fallback = {
  fetchMetadata: noop,
  addDownload: noop,
  listDownloads: async () => [],
  pauseDownload: noop,
  resumeDownload: noop,
  cancelDownload: noop,
  removeDownload: async () => [],
  setConcurrency: noop,
  onDownloadUpdate: () => noopUnsub,
  addPlaylistDownload: noop,
  listPlaylistDownloads: async () => [],
  cancelPlaylistDownload: noop,
  onPlaylistDownloadUpdate: () => noopUnsub,
  toFileUrl: async (p) => p,
  toRawFileUrl: async (p) => p,
  listPlaylists: async () => [],
  createPlaylist: async () => ({ playlist: null, playlists: [] }),
  renamePlaylist: async () => [],
  deletePlaylist: async () => [],
  togglePlaylistTrack: async () => ({ playlists: [], duplicateOf: [] }),
  removePlaylistTrack: async () => [],
  addPlaylistTracks: async () => ({ added: 0, playlists: [], duplicates: [] }),
  resyncPlaylists: async () => [],
  openPlaylistsFolder: noop,
  importPlaylists: async () => ({ imported: 0, playlists: [] }),
  downloadMissingTracks: async () => ({ queued: 0, alreadyLinked: 0 }),
  exportPlaylist: async () => ({ path: null }),
  onPlaylistsUpdate: () => noopUnsub,
  listLibrary: async () => [],
  removeFromLibrary: async () => [],
  restoreLibraryItem: async () => [],
  purgeLibraryItem: async () => [],
  redownloadLibraryItem: async () => ({ queued: false }),
  toggleFavorite: async () => [],
  onLibraryUpdate: () => noopUnsub,
  getLibraryStats: async () => ({ totalCount: 0, totalSizeBytes: 0, topFormat: null, longestPlaylist: null, playlistCount: 0 }),

  getProfile: async () => null,
  setProfileUsername: async () => null,
  setProfilePreferences: async () => null,
  pickProfileAvatar: async () => null,
  getProfileAvatarUrl: async () => null,
  exportProfile: async () => ({ path: null }),
  pickProfileImport: async () => null,
  applyProfileImport: async () => null,

  probeMedia: async () => ({ duration: 0, hasVideo: false, hasAudio: false, width: 0, height: 0 }),
  exportClip: async () => ({ path: null, sizeBytes: 0 }),
  cancelClipExport: async () => false,
  onClipProgress: () => noopUnsub,

  getSettings: async () => ({ downloadDir: "", maxConcurrent: 3, volume: 0.8, language: "pt-BR" }),
  setSettings: async () => ({}),
  updateDiscordActivity: async () => {},
  clearDiscordActivity: async () => {},
  checkDependencyVersions: async () => ({
    ytDlpVersion: null,
    ffmpegVersion: null,
    ffprobeVersion: null,
    latestYtDlpVersion: null,
    ytDlpUpdateAvailable: false,
    checkError: null,
  }),
  updateYtDlp: async () => ({ version: null }),
  chooseFfmpeg: async () => null,
  resetFfmpeg: async () => null,
  chooseFolder: async () => null,
  openPath: noop,
  focusApp: async () => false,
  log: noop,
  openLogsFolder: noop,

  publishMiniState: () => {},
  publishMiniSpectrum: () => {},
  onMiniCommand: () => noopUnsub,
  onMiniVisibility: () => noopUnsub,
  sendMiniCommand: () => {},
  onMiniState: () => noopUnsub,
  onMiniSpectrum: () => noopUnsub,
  onWindowVisibility: () => noopUnsub,
  restoreMainWindow: async () => false,
  closeMiniPlayer: async () => false,
};

const aurora = typeof window !== "undefined" && window.aurora ? window.aurora : fallback;

// True only when the real preload bridge is present — i.e. the app is running
// as the Aurora desktop app rather than in a plain browser tab. UI that offers
// to act *on* the app (focusing its window, opening folders) has nothing to
// talk to otherwise and should present itself as unavailable, not silently fail.
export const isDesktopAppAvailable = aurora !== fallback;

export default aurora;
