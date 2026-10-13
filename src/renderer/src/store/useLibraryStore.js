import { create } from "zustand";
import aurora from "../lib/aurora.js";
import logger from "../lib/logger.js";

const useLibraryStore = create((set, get) => ({
  library: [],
  playlists: [],
  activeFilter: "__all", // "__all" | "__favorites" | playlist id
  search: "",
  stats: null,

  async loadStats() {
    try {
      set({ stats: await aurora.getLibraryStats() });
    } catch (e) {
      logger.error("Falha ao carregar estatísticas da biblioteca", { message: e.message });
    }
  },

  selectionMode: false,
  selectedIds: [],
  lastSelectedIndex: null,

  setSearch: (search) => set({ search }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),

  enterSelectionMode: () => set({ selectionMode: true, selectedIds: [], lastSelectedIndex: null }),
  exitSelectionMode: () => set({ selectionMode: false, selectedIds: [], lastSelectedIndex: null }),

  // Supports plain click (toggle one) and shift-click (select the whole range
  // between the last clicked row and this one), like Explorer/Finder lists.
  toggleSelect(id, index, shiftKey) {
    const { selectedIds, lastSelectedIndex, visibleItems } = get();
    if (shiftKey && lastSelectedIndex !== null) {
      const items = visibleItems();
      const [from, to] = [lastSelectedIndex, index].sort((a, b) => a - b);
      const rangeIds = items.slice(from, to + 1).map((i) => i.id);
      const merged = new Set([...selectedIds, ...rangeIds]);
      set({ selectedIds: [...merged], lastSelectedIndex: index });
      return;
    }
    const has = selectedIds.includes(id);
    set({
      selectedIds: has ? selectedIds.filter((i) => i !== id) : [...selectedIds, id],
      lastSelectedIndex: index,
    });
  },

  selectAllVisible() {
    const ids = get().visibleItems().map((i) => i.id);
    set({ selectedIds: ids });
  },

  async addSelectedToPlaylist(playlistId) {
    const { selectedIds } = get();
    try {
      const res = await aurora.addPlaylistTracks(playlistId, selectedIds);
      set({ playlists: res.playlists, selectionMode: false, selectedIds: [], lastSelectedIndex: null });
      return res;
    } catch (e) {
      logger.error("Falha ao adicionar músicas selecionadas à playlist", { playlistId, message: e.message });
      return { added: 0 };
    }
  },

  async loadLibrary() {
    try {
      const library = await aurora.listLibrary();
      logger.info("Biblioteca carregada", { count: library.length });
      set({ library });
    } catch (e) {
      logger.error("Falha ao carregar a biblioteca. Mantendo o estado anterior na tela", { message: e.message });
    }
  },
  async loadPlaylists() {
    try {
      set({ playlists: await aurora.listPlaylists() });
    } catch (e) {
      logger.error("Falha ao carregar playlists", { message: e.message });
    }
  },

  async toggleFavorite(id) {
    try {
      set({ library: await aurora.toggleFavorite(id) });
    } catch (e) {
      logger.error("Falha ao favoritar item da biblioteca", { id, message: e.message });
    }
  },
  async removeFromLibrary(id) {
    try {
      set({ library: await aurora.removeFromLibrary(id) });
      logger.info("Item marcado como removido", { id });
    } catch (e) {
      logger.error("Falha ao remover item da biblioteca", { id, message: e.message });
    }
  },
  async restoreLibraryItem(id) {
    try {
      set({ library: await aurora.restoreLibraryItem(id) });
      logger.info("Item restaurado na biblioteca", { id });
    } catch (e) {
      logger.error("Falha ao restaurar item da biblioteca", { id, message: e.message });
    }
  },
  async purgeLibraryItem(id) {
    try {
      set({ library: await aurora.purgeLibraryItem(id) });
      logger.info("Item apagado definitivamente da biblioteca", { id });
    } catch (e) {
      logger.error("Falha ao apagar item definitivamente", { id, message: e.message });
    }
  },
  async redownloadLibraryItem(id) {
    try {
      const res = await aurora.redownloadLibraryItem(id);
      logger.info("Redownload solicitado para item da biblioteca", { id, queued: res.queued });
      return res;
    } catch (e) {
      logger.error("Falha ao solicitar redownload", { id, message: e.message });
      return { queued: false };
    }
  },
  async createPlaylist(name) {
    try {
      const res = await aurora.createPlaylist(name);
      set({ playlists: res.playlists });
      return res.playlist;
    } catch (e) {
      logger.error("Falha ao criar playlist", { name, message: e.message });
      return null;
    }
  },
  async renamePlaylist(id, name) {
    try {
      set({ playlists: await aurora.renamePlaylist(id, name) });
      logger.info("Playlist renomeada", { id, name });
      return true;
    } catch (e) {
      logger.error("Falha ao renomear playlist", { id, name, message: e.message });
      return false;
    }
  },
  async deletePlaylist(id) {
    try {
      set({ playlists: await aurora.deletePlaylist(id) });
      if (get().activeFilter === id) set({ activeFilter: "__all" });
      logger.info("Playlist excluída", { id });
    } catch (e) {
      logger.error("Falha ao excluir playlist", { id, message: e.message });
    }
  },
  async togglePlaylistTrack(playlistId, trackId) {
    try {
      const res = await aurora.togglePlaylistTrack(playlistId, trackId);
      set({ playlists: res.playlists });
      return res;
    } catch (e) {
      logger.error("Falha ao atualizar faixa da playlist", { playlistId, trackId, message: e.message });
      return { duplicateOf: [] };
    }
  },
  // Detaches a single track by its position in the playlist file — the only
  // way to get rid of a "ghost" entry left behind after its library item was
  // removed/purged (toggleTrack can't reach those since it matches by
  // library item, not by the track's own position).
  async removePlaylistTrack(playlistId, position) {
    try {
      const playlists = await aurora.removePlaylistTrack(playlistId, position);
      set({ playlists });
    } catch (e) {
      logger.error("Falha ao remover faixa da playlist", { playlistId, position, message: e.message });
    }
  },

  async resyncPlaylists() {
    try {
      const playlists = await aurora.resyncPlaylists();
      logger.info("Playlists sincronizadas com a pasta Playlists", { count: playlists.length });
      set({ playlists });
    } catch (e) {
      logger.error("Falha ao sincronizar playlists", { message: e.message });
    }
  },

  async importPlaylists() {
    try {
      const res = await aurora.importPlaylists();
      logger.info("Playlists importadas", { imported: res.imported });
      set({ playlists: res.playlists });
      return res;
    } catch (e) {
      logger.error("Falha ao importar playlists", { message: e.message });
      return { imported: 0, playlists: get().playlists };
    }
  },

  async exportPlaylist(playlistId) {
    try {
      const res = await aurora.exportPlaylist(playlistId);
      if (res.path) logger.info("Playlist exportada", { playlistId, path: res.path });
      return res;
    } catch (e) {
      logger.error("Falha ao exportar playlist", { playlistId, message: e.message });
      return { path: null };
    }
  },

  async downloadMissingTracks(playlistId) {
    try {
      const res = await aurora.downloadMissingTracks(playlistId);
      logger.info("Download de faixas faltantes solicitado", { playlistId, queued: res.queued, alreadyLinked: res.alreadyLinked });
      return res;
    } catch (e) {
      logger.error("Falha ao baixar faixas faltantes da playlist", { playlistId, message: e.message });
      return { queued: 0, alreadyLinked: 0 };
    }
  },

  activePlaylist() {
    const { playlists, activeFilter } = get();
    return playlists.find((p) => p.id === activeFilter) ?? null;
  },

  visibleItems() {
    const { library, playlists, activeFilter, search } = get();
    const q = search.trim().toLowerCase();
    const matches = (item) => !q || item.title.toLowerCase().includes(q);

    if (activeFilter === "__all") return library.filter(matches);
    if (activeFilter === "__favorites") return library.filter((i) => i.favorite && matches(i));

    const playlist = playlists.find((p) => p.id === activeFilter);
    if (!playlist) return [];

    if (playlist.source === "file") {
      // File-synced playlists carry an explicit track order — walk it directly
      // instead of filtering the library array, so position is preserved.
      return playlist.tracks
        .filter((t) => t.libraryId)
        .map((t) => library.find((i) => i.id === t.libraryId))
        .filter((item) => item && matches(item));
    }

    return library.filter((item) => playlist.trackIds.includes(item.id) && matches(item));
  },
}));

aurora.onLibraryUpdate((library) => {
  logger.info("Biblioteca atualizada via evento push", { count: library.length });
  useLibraryStore.setState({ library });
});

aurora.onPlaylistsUpdate((playlists) => {
  logger.info("Playlists atualizadas via evento push", { count: playlists.length });
  useLibraryStore.setState({ playlists });
});

export default useLibraryStore;
