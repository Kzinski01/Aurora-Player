import { create } from "zustand";
import aurora from "../lib/aurora.js";
import logger from "../lib/logger.js";
import { attachAnalyser, resumeAnalyser } from "../lib/spectrum.js";

const DEFAULT_VOLUME = 0.8;

// Media arrives over the app's aurora-media:// scheme (see main/mediaProtocol.js),
// which answers with Access-Control-Allow-Origin. Declaring the request
// anonymous is what makes the response CORS-clean, and only a CORS-clean
// element may be read by WebAudio for the mini player's spectrum.
const CROSS_ORIGIN_MODE = "anonymous";

const audio = typeof Audio !== "undefined" ? new Audio() : null;
if (audio) {
  audio.volume = DEFAULT_VOLUME;
  audio.crossOrigin = CROSS_ORIGIN_MODE;
}

// Created eagerly (like `audio` above) so it already exists by the time the
// first video track plays — Player.jsx only reparents this node into its
// visible container, it never (re)creates it, which avoids a race where
// _loadCurrent would run before a JSX-rendered <video> had mounted.
const video = typeof document !== "undefined" ? document.createElement("video") : null;
if (video) {
  video.volume = DEFAULT_VOLUME;
  video.crossOrigin = CROSS_ORIGIN_MODE;
  video.playsInline = true;
  video.style.display = "none";
  document.body.appendChild(video);
}

// The volume slider fires on every pointer-move during a drag — persisting
// each one would spam the settings file with writes mid-gesture. Only the
// value left standing once the user stops moving needs to survive to the
// next launch.
const PERSIST_VOLUME_DELAY_MS = 400;
let persistVolumeTimer = null;

// Flipped off for good the first time a track has to fall back to file://,
// because from then on the graph can no longer be attached safely.
let analyserAllowed = true;
function persistVolume(v) {
  clearTimeout(persistVolumeTimer);
  persistVolumeTimer = setTimeout(() => {
    aurora.setSettings({ volume: v }).catch((e) => logger.error("Falha ao salvar o volume", { message: e.message }));
  }, PERSIST_VOLUME_DELAY_MS);
}

// Discord's "time remaining" countdown is driven by the startTimestamp/
// endTimestamp sent once, not by us re-sending every second — so this only
// needs to fire on the events that actually change what should be shown
// (play/pause/new track), never on the continuous "timeupdate" tick.
function pushDiscordActivity() {
  const { queue, index, isPlaying, currentTime, duration } = usePlayerStore.getState();
  const track = queue[index];
  if (!track) {
    aurora.clearDiscordActivity();
    return;
  }
  aurora.updateDiscordActivity({
    title: track.title,
    uploader: track.uploader,
    thumbnail: track.thumbnail,
    url: track.url,
    subtitle: track.mode === "audio" ? track.format?.toUpperCase() : `${track.resolution ?? ""}p`,
    isPlaying,
    elapsedSec: currentTime,
    durationSec: duration,
  });
}

function bindMediaEvents(el) {
  el.addEventListener("play", () => {
    usePlayerStore.setState({ isPlaying: true });
    pushDiscordActivity();
  });
  el.addEventListener("pause", () => {
    usePlayerStore.setState({ isPlaying: false });
    pushDiscordActivity();
  });
  el.addEventListener("timeupdate", () =>
    usePlayerStore.setState({ currentTime: el.currentTime, duration: el.duration || 0 })
  );
  // Duration isn't known yet at "play" time — re-push once it is, so the
  // progress bar Discord draws has the right end timestamp from the start.
  // The store has to be updated here rather than waiting for "timeupdate":
  // that event deliberately doesn't push to Discord, so a duration published
  // only from there would never reach a presence update.
  el.addEventListener("loadedmetadata", () => {
    usePlayerStore.setState({ duration: el.duration || 0 });
    pushDiscordActivity();
  });
  el.addEventListener("ended", () => {
    const { repeat } = usePlayerStore.getState();
    if (repeat === "one") {
      el.currentTime = 0;
      el.play();
      return;
    }
    usePlayerStore.getState().next();
  });
}

const usePlayerStore = create((set, get) => ({
  queue: [],
  index: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: DEFAULT_VOLUME,
  shuffle: false,
  repeat: "off", // "off" | "all" | "one"
  playbackError: null,
  videoVisible: true,

  current: () => get().queue[get().index] ?? null,

  _activeMedia() {
    return get().current()?.mode === "video" ? video : audio;
  },

  toggleVideoVisible: () => set((s) => ({ videoVisible: !s.videoVisible })),

  async playFrom(list, startIndex) {
    set({ queue: list, index: startIndex });
    await get()._loadCurrent();
  },

  async _loadCurrent() {
    const item = get().current();
    const media = get()._activeMedia();
    if (!item || !media) return;
    if (!item.filePath) {
      logger.error("Item da biblioteca sem arquivo associado. Não é possível reproduzir", { id: item.id, title: item.title });
      set({ playbackError: `"${item.title}" não tem um arquivo associado e não pode ser reproduzido.` });
      return;
    }
    const other = media === audio ? video : audio;
    if (other && !other.paused) other.pause();
    try {
      const src = await aurora.toFileUrl(item.filePath);
      media.crossOrigin = CROSS_ORIGIN_MODE;
      media.src = src;
      media.volume = get().volume;
      await media.play();
      // Only after the custom scheme has demonstrably worked — an analyser
      // attached to a source that later has to fall back to file:// would
      // silence the element outright (see spectrum.js).
      if (analyserAllowed) {
        attachAnalyser(media);
        resumeAnalyser();
      }
      set({ playbackError: null });
    } catch (e) {
      // An interrupted play() is not a source problem: it means a newer load or
      // a pause superseded this one (skipping tracks quickly, pausing during
      // load). Falling back on it would needlessly abandon aurora-media:// and
      // disable the analyser for the rest of the session.
      if (e.name === "AbortError") {
        logger.info("Reprodução substituída por outra ação antes de começar", { id: item.id });
        return;
      }
      logger.warn("Falha ao reproduzir pelo esquema aurora-media. Tentando o caminho direto do arquivo", {
        id: item.id,
        filePath: item.filePath,
        message: e.message,
      });
      // Playback matters more than the visualizer: fall back to the plain
      // file:// URL, giving up the spectrum (a file:// source is opaque to
      // WebAudio) rather than leaving the track unplayable.
      try {
        analyserAllowed = false;
        media.removeAttribute("crossorigin");
        media.crossOrigin = null;
        media.src = await aurora.toRawFileUrl(item.filePath);
        media.volume = get().volume;
        await media.play();
        set({ playbackError: null });
      } catch (fallbackError) {
        logger.error("Falha ao reproduzir arquivo", {
          id: item.id,
          filePath: item.filePath,
          message: fallbackError.message,
        });
        set({ playbackError: `Não foi possível reproduzir "${item.title}".` });
      }
    }
  },

  toggle() {
    const media = get()._activeMedia();
    if (!media) return;
    if (media.paused) media.play();
    else media.pause();
  },

  seek(seconds) {
    const media = get()._activeMedia();
    if (!media) return;
    media.currentTime = seconds;
  },

  setVolume(v) {
    set({ volume: v });
    if (audio) audio.volume = v;
    if (video) video.volume = v;
    persistVolume(v);
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({ repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off" })),

  _pickNextIndex() {
    const { queue, index, shuffle, repeat } = get();
    if (queue.length === 0) return -1;
    if (shuffle) {
      if (queue.length === 1) return 0;
      let next;
      do next = Math.floor(Math.random() * queue.length);
      while (next === index);
      return next;
    }
    const next = index + 1;
    if (next >= queue.length) return repeat === "all" ? 0 : -1;
    return next;
  },

  _pickPrevIndex() {
    const { queue, index, repeat } = get();
    if (queue.length === 0) return -1;
    const prev = index - 1;
    if (prev < 0) return repeat === "all" ? queue.length - 1 : 0;
    return prev;
  },

  async next() {
    const idx = get()._pickNextIndex();
    if (idx === -1) return;
    set({ index: idx });
    await get()._loadCurrent();
  },

  async prev() {
    const idx = get()._pickPrevIndex();
    if (idx === -1) return;
    set({ index: idx });
    await get()._loadCurrent();
  },
}));

if (audio) bindMediaEvents(audio);
if (video) bindMediaEvents(video);

// Settings load asynchronously over IPC, so playback can start with the
// default volume for an instant before this resolves — same tradeoff the
// rest of the app makes (see useDownloadStore's loadSettings) rather than
// blocking the whole UI on a settings round-trip before anything renders.
aurora.getSettings().then((settings) => {
  if (typeof settings.volume !== "number") return;
  // Not setVolume(): that also schedules a write back to settings, which
  // here would just re-save the value this load came from.
  usePlayerStore.setState({ volume: settings.volume });
  if (audio) audio.volume = settings.volume;
  if (video) video.volume = settings.volume;
});

export default usePlayerStore;
export { video as videoElement };
