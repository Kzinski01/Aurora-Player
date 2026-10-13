import { useCallback, useMemo } from "react";
import aurora, { isDesktopAppAvailable } from "../lib/aurora.js";
import { formatDuration } from "../lib/format.js";
import logger from "../lib/logger.js";
import usePlayerStore from "../store/usePlayerStore.js";
import { useTranslation } from "../i18n/index.js";

// Everything the presence card needs to render, derived from the player store.
// Kept apart from the component so the card stays a pure rendering concern and
// the "what is playing right now" logic can be reused (or tested) on its own.
//
// The store already updates currentTime from the media element's "timeupdate"
// event, so progress here follows real playback without a timer of its own.
export default function useRichPresence({ appName = "Aurora Player", sourceLabel } = {}) {
  // Selected field by field on purpose: returning a fresh object from one
  // selector would give zustand a new reference every tick and re-render the
  // card even when nothing it displays actually changed.
  const track = usePlayerStore((s) => s.queue[s.index] ?? null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const { t } = useTranslation();

  const focusApp = useCallback(async () => {
    if (!isDesktopAppAvailable) return;
    try {
      await aurora.focusApp();
    } catch (e) {
      logger.error("Não foi possível focar a janela do aplicativo", { message: e.message });
    }
  }, []);

  const presence = useMemo(() => {
    if (!track) {
      return {
        hasMedia: false,
        sourceLabel: sourceLabel ?? t("richPresence.sourceLabel", { appName }),
        trackKey: "idle",
      };
    }

    // Downloads made before the library stored the channel name have no
    // uploader — the format/resolution is the next most useful thing to show
    // there, and it keeps the line from collapsing to empty.
    const fallbackSubtitle = track.mode === "audio" ? track.format?.toUpperCase() : `${track.resolution ?? ""}p`;

    return {
      hasMedia: true,
      sourceLabel: sourceLabel ?? `Ouvindo ${appName}`,
      trackKey: track.id,
      title: track.title,
      artist: track.uploader || fallbackSubtitle || appName,
      coverUrl: track.thumbnail || null,
      isPlaying,
      elapsedLabel: formatDuration(currentTime),
      durationLabel: formatDuration(duration),
      progressPercent: duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0,
    };
  }, [track, isPlaying, currentTime, duration, appName, sourceLabel, t]);

  return { ...presence, canFocusApp: isDesktopAppAvailable, focusApp };
}
