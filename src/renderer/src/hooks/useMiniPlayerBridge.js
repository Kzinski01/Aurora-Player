import useResolvedTheme from "./useResolvedTheme.js";
import { useEffect } from "react";
import aurora from "../lib/aurora.js";
import logger from "../lib/logger.js";
import usePlayerStore from "../store/usePlayerStore.js";
import useLibraryStore from "../store/useLibraryStore.js";
import useDownloadStore from "../store/useDownloadStore.js";
import useProfileStore from "../store/useProfileStore.js";
import { readSpectrum } from "../lib/spectrum.js";

// The main window is the only place playback exists, so it is also the only
// place that can describe it. This hook is that side of the link: it publishes
// a compact snapshot of "what is playing" and executes the commands the mini
// player sends back. Mounted once, from App.
//
// The spectrum runs on an interval rather than requestAnimationFrame on
// purpose — while the mini player is up, this window is hidden, and Chromium
// stops serving animation frames to a window nobody can see. The mini player's
// canvas runs its own rAF loop and eases between the frames this publishes, so
// this only has to be fast enough that the easing has something current to aim
// at: ~30/second, against a 60 fps render.
const SPECTRUM_INTERVAL_MS = 33;

function buildState() {
  const { queue, index, isPlaying, currentTime, duration, shuffle } = usePlayerStore.getState();
  const track = queue[index] ?? null;
  if (!track) return { hasTrack: false };

  // Favourite status is read from the library rather than the queued copy:
  // the queue holds a snapshot taken when playback started, so a track
  // favourited since then would still show as unfavourited.
  const libraryItem = useLibraryStore.getState().library.find((i) => i.id === track.id);

  return {
    hasTrack: true,
    id: track.id,
    title: track.title ?? "",
    uploader: track.uploader ?? "",
    thumbnail: track.thumbnail ?? null,
    subtitle: track.mode === "audio" ? track.format?.toUpperCase() ?? "" : `${track.resolution ?? ""}p`,
    isPlaying,
    currentTime,
    duration,
    shuffle,
    favorite: Boolean(libraryItem?.favorite ?? track.favorite),
  };
}

export default function useMiniPlayerBridge() {
  const theme = useResolvedTheme();
  const language = useDownloadStore((s) => s.settings.language);
  const accentColor = useProfileStore((s) => s.profile?.accentColor);

  // Theme, language and accent ride along with the state payload so the mini
  // player never has to read settings or the profile itself — one source of
  // truth, and it repaints the moment the user changes any of them here.
  useEffect(() => {
    const publish = () => aurora.publishMiniState({ ...buildState(), theme, language, accentColor });
    publish();
    const unsubscribePlayer = usePlayerStore.subscribe(publish);
    const unsubscribeLibrary = useLibraryStore.subscribe(publish);
    return () => {
      unsubscribePlayer();
      unsubscribeLibrary();
    };
  }, [theme, language, accentColor]);

  useEffect(() => {
    return aurora.onMiniCommand((command) => {
      const player = usePlayerStore.getState();
      switch (command?.action) {
        case "toggle":
          player.toggle();
          break;
        case "next":
          player.next();
          break;
        case "prev":
          player.prev();
          break;
        case "seek":
          if (Number.isFinite(command.value)) player.seek(command.value);
          break;
        case "shuffle":
          player.toggleShuffle();
          break;
        case "favorite": {
          const track = player.current();
          if (track?.id) useLibraryStore.getState().toggleFavorite(track.id);
          break;
        }
        default:
          logger.warn("Comando desconhecido vindo do mini player", { command });
      }
    });
  }, []);

  useEffect(() => {
    let timer = null;

    const stop = () => {
      clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        const player = usePlayerStore.getState();
        const media = player._activeMedia();
        // A paused track has nothing to analyse — publishing an empty frame
        // lets the visualiser settle to its resting line instead of freezing
        // on the last loud moment.
        const bars = player.isPlaying && media ? readSpectrum(media) : null;
        aurora.publishMiniSpectrum(bars);
      }, SPECTRUM_INTERVAL_MS);
    };

    const unsubscribe = aurora.onMiniVisibility((visible) => (visible ? start() : stop()));
    return () => {
      unsubscribe();
      stop();
    };
  }, []);
}
