import { create } from "zustand";
import aurora from "../lib/aurora.js";
import logger from "../lib/logger.js";

// State for the clip editor. The selection (in/out points) lives here rather
// than in the page component so that navigating away and back does not silently
// discard a range the user spent time setting.

const DEFAULT_GIF_FPS = 15;
const DEFAULT_GIF_WIDTH = 480;

// Below this, a trim produces a file too short to be useful and ffmpeg starts
// returning empty outputs.
const MIN_CLIP_SECONDS = 0.2;

const useEditorStore = create((set, get) => ({
  item: null, // library item being edited
  info: null, // ffprobe result: duration, hasVideo, dimensions
  loading: false,
  // Kept apart because they fail for different reasons and are recovered from
  // differently: a probe failure means the file can't be edited at all, while
  // an export failure leaves the selection intact and worth retrying.
  loadError: null,
  exportError: null,

  start: 0,
  end: 0,

  target: "video", // "video" | "audio" | "gif" | "webp"
  precise: true, // video only: re-encode for an exact cut vs instant stream copy
  audioFormat: null, // audio only: null keeps the source codec (lossless, instant)
  fps: DEFAULT_GIF_FPS,
  width: DEFAULT_GIF_WIDTH,

  exporting: false,
  progress: 0,
  result: null, // { path, sizeBytes }

  async open(item) {
    set({
      item,
      info: null,
      loading: true,
      loadError: null,
      exportError: null,
      start: 0,
      end: 0,
      result: null,
      progress: 0,
      // An audio-only item can never produce a video or an animation, so the
      // target is decided by the file rather than left at whatever the last
      // edit used.
      target: item?.mode === "audio" ? "audio" : "video",
      audioFormat: null,
      precise: true,
    });
    try {
      const info = await aurora.probeMedia(item.filePath);
      set({
        info,
        loading: false,
        end: info.duration,
        // Default the animation width to the source's own, capped — upscaling a
        // GIF only makes it heavier, never sharper.
        width: info.width ? Math.min(info.width, DEFAULT_GIF_WIDTH) : DEFAULT_GIF_WIDTH,
      });
    } catch (e) {
      logger.error("Falha ao inspecionar o arquivo para edição", { filePath: item?.filePath, message: e.message });
      set({ loading: false, loadError: e.message });
    }
  },

  close: () => set({ item: null, info: null, result: null, progress: 0, exporting: false }),

  // One patch setter instead of five near-identical ones. Every option change
  // also clears `result`: the "open exported file" button must never point at
  // a file produced with different settings than the ones now on screen.
  updateSettings: (patch) => set({ ...patch, result: null }),

  // Both setters clamp against each other so the selection can never invert,
  // which would otherwise reach ffmpeg as a negative duration.
  setStart(seconds) {
    const { end, info } = get();
    const max = Math.max(0, (end || info?.duration || 0) - MIN_CLIP_SECONDS);
    set({ start: Math.min(Math.max(0, seconds), max), result: null });
  },
  setEnd(seconds) {
    const { start, info } = get();
    const duration = info?.duration || 0;
    set({ end: Math.max(Math.min(seconds, duration), start + MIN_CLIP_SECONDS), result: null });
  },

  clipDuration() {
    const { start, end } = get();
    return Math.max(0, end - start);
  },

  async exportClip() {
    const { item, start, end, target, precise, audioFormat, fps, width } = get();
    if (!item || get().exporting) return null;

    set({ exporting: true, progress: 0, result: null, exportError: null });
    const stopListening = aurora.onClipProgress((progress) => set({ progress }));
    try {
      const result = await aurora.exportClip({
        filePath: item.filePath,
        start,
        end,
        target,
        options: { precise, audioFormat, fps, width },
      });
      set({ result, progress: 1 });
      logger.info("Trecho exportado", { target, path: result.path, sizeBytes: result.sizeBytes });
      return result;
    } catch (e) {
      logger.error("Falha ao exportar o trecho", { target, message: e.message });
      set({ exportError: e.message });
      return null;
    } finally {
      stopListening();
      set({ exporting: false });
    }
  },

  async cancelExport() {
    await aurora.cancelClipExport();
  },
}));

export default useEditorStore;
export { MIN_CLIP_SECONDS };
