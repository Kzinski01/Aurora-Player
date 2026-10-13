import { useEffect, useRef, useState } from "react";
import aurora from "../lib/aurora.js";

// Drives the editor's own preview element.
//
// Deliberately separate from usePlayerStore: the editor scrubs, seeks and loops
// constantly, and sharing the player's media element would mean every drag of a
// trim handle interrupted whatever the user was listening to.
//
// Playback is confined to the selected range and returns to the in-point at the
// end, because the only question a preview answers here is "is this the right
// piece?".
export default function useClipPreview({ filePath, start, end }) {
  const mediaRef = useRef(null);
  const [url, setUrl] = useState(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!filePath) return undefined;
    let active = true;
    aurora.toFileUrl(filePath).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [filePath]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return undefined;

    const onTimeUpdate = () => {
      setPlayhead(media.currentTime);
      if (media.currentTime >= end) {
        media.currentTime = start;
        media.pause();
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    media.addEventListener("timeupdate", onTimeUpdate);
    media.addEventListener("play", onPlay);
    media.addEventListener("pause", onPause);
    return () => {
      media.removeEventListener("timeupdate", onTimeUpdate);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("pause", onPause);
    };
  }, [start, end]);

  function toggle() {
    const media = mediaRef.current;
    if (!media) return;
    if (!media.paused) {
      media.pause();
      return;
    }
    // Restart from the in-point whenever the playhead sits outside the
    // selection, so pressing play always previews the selection itself.
    if (media.currentTime < start || media.currentTime >= end) media.currentTime = start;
    media.play().catch(() => {});
  }

  function seek(seconds) {
    const media = mediaRef.current;
    if (media) media.currentTime = seconds;
    setPlayhead(seconds);
  }

  function pause() {
    mediaRef.current?.pause();
  }

  return { mediaRef, url, playhead, playing, toggle, seek, pause };
}
