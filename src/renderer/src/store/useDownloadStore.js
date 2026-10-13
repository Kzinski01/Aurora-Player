import { create } from "zustand";
import aurora from "../lib/aurora.js";
import logger from "../lib/logger.js";

const useDownloadStore = create((set, get) => ({
  results: [], // { url, meta, mode, resolution, format }
  jobs: [], // download queue jobs, newest first
  playlistDownloads: [],
  analysisGeneration: 0,
  settings: { downloadDir: "", maxConcurrent: 3, language: "pt-BR" },

  async analyzeUrls(urls, onError) {
    const generation = get().analysisGeneration + 1;
    set({ analysisGeneration: generation });
    const existing = new Set(get().results.map((r) => r.url));
    for (const url of urls) {
      if (get().analysisGeneration !== generation) return;
      if (existing.has(url)) continue;
      try {
        const meta = await aurora.fetchMetadata(url);
        if (get().analysisGeneration !== generation) return;
        // A "ytsearch1:query" input resolves to a real watch URL in meta.url —
        // key/store the result under that, not the pseudo-url, so it matches
        // library/playlist entries correctly and doesn't re-search if pasted again.
        const resolvedUrl = meta.url || url;
        if (existing.has(resolvedUrl)) continue;
        existing.add(resolvedUrl);
        set((s) => ({
          results: [
            { url: resolvedUrl, meta, mode: "video", resolution: meta.resolutions?.[0] ?? null, format: "mp3" },
            ...s.results,
          ],
        }));
      } catch (e) {
        if (get().analysisGeneration === generation) onError?.(url, e.message);
      }
    }
  },

  updateResult(url, patch) {
    set((s) => ({ results: s.results.map((r) => (r.url === url ? { ...r, ...patch } : r)) }));
  },

  removeResult(url) {
    set((s) => ({ results: s.results.filter((r) => r.url !== url) }));
  },

  async addToQueue(result) {
    const { settings } = get();
    const payload = {
      url: result.url,
      title: result.meta.title,
      uploader: result.meta.uploader,
      thumbnail: result.meta.thumbnail,
      mode: result.mode,
      resolution: result.mode === "video" ? result.resolution : null,
      audioFormat: result.mode === "audio" ? result.format : null,
      outputDir: settings.downloadDir,
    };
    try {
      const id = result.meta.isPlaylist
        ? await aurora.addPlaylistDownload(payload)
        : await aurora.addDownload(payload);
      logger.info("Download adicionado à fila", { id, url: result.url });
      get().removeResult(result.url);
      // The main process pushes "download:update" right away, but fetch the
      // authoritative list too in case that push races with this resolving.
      await get().loadJobs();
      if (result.meta.isPlaylist) await get().loadPlaylistDownloads();
      return { ok: true, id };
    } catch (e) {
      logger.error("Falha ao adicionar download à fila", { url: result.url, payload, message: e.message });
      return { ok: false, error: e.message };
    }
  },

  setJob(job) {
    set((s) => {
      const idx = s.jobs.findIndex((j) => j.id === job.id);
      if (idx === -1) return { jobs: [job, ...s.jobs] };
      const jobs = [...s.jobs];
      jobs[idx] = job;
      return { jobs };
    });
  },

  setPlaylistDownload(group) {
    set((state) => ({
      playlistDownloads: [group, ...state.playlistDownloads.filter((item) => item.id !== group.id)],
    }));
  },

  async loadPlaylistDownloads() {
    try {
      set({ playlistDownloads: await aurora.listPlaylistDownloads() });
    } catch (error) {
      logger.error("Falha ao carregar downloads de playlists", { message: error.message });
    }
  },

  async removeJob(id) {
    const jobs = await aurora.removeDownload(id);
    set({ jobs });
  },

  async loadJobs() {
    try {
      const jobs = await aurora.listDownloads();
      logger.info("Fila carregada", { count: jobs.length });
      set({ jobs });
    } catch (e) {
      logger.error("Falha ao carregar a fila de downloads", { message: e.message });
    }
  },

  async loadSettings() {
    const settings = await aurora.getSettings();
    set({ settings });
  },

  async patchSettings(patch) {
    const settings = await aurora.setSettings(patch);
    set({ settings });
  },
}));

aurora.onDownloadUpdate((job) => useDownloadStore.getState().setJob(job));
aurora.onPlaylistDownloadUpdate((group) => useDownloadStore.getState().setPlaylistDownload(group));

export default useDownloadStore;
