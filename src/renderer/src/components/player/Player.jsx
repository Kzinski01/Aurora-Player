import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, MonitorPlay, X } from "lucide-react";
import clsx from "clsx";
import usePlayerStore, { videoElement } from "../../store/usePlayerStore.js";
import { formatDuration } from "../../lib/format.js";
import Slider from "../ui/Slider.jsx";
import SliderNumberFlow from "../ui/SliderNumberFlow.jsx";
import { useTranslation } from "../../i18n/index.js";

export default function Player() {
  const { t } = useTranslation();
  const { queue, index, isPlaying, currentTime, duration, volume, shuffle, repeat, videoVisible } = usePlayerStore();
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const toggleVideoVisible = usePlayerStore((s) => s.toggleVideoVisible);

  const track = queue[index] ?? null;
  const isVideoTrack = track?.mode === "video";
  const videoContainerRef = useRef(null);

  useEffect(() => {
    if (!videoElement) return;
    if (isVideoTrack && videoVisible && videoContainerRef.current) {
      videoContainerRef.current.appendChild(videoElement);
      videoElement.style.display = "block";
    } else {
      videoElement.style.display = "none";
    }
  }, [isVideoTrack, videoVisible]);

  return (
    <AnimatePresence>
      {track && (
        <>
          <AnimatePresence>
            {isVideoTrack && videoVisible && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.97 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="glass-strong fixed bottom-[100px] right-6 z-50 w-[640px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-ink/[0.08] shadow-glass"
              >
                <div className="relative">
                  <button
                    onClick={toggleVideoVisible}
                    title={t("player.closeVideo")}
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                  >
                    <X size={15} />
                  </button>
                  <div ref={videoContainerRef} className="aspect-video w-full bg-black [&>video]:h-full [&>video]:w-full [&>video]:object-contain" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.footer
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="player-dock"
        >
          <div className="player-track">
            <motion.div
              layoutId="player-thumb"
              className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-ink/[0.06]"
              animate={{ scale: isPlaying ? 1 : 0.94 }}
              transition={{ duration: 0.3 }}
            >
              {track.thumbnail && <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />}
            </motion.div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{track.title}</div>
              <div className="truncate text-[11.5px] text-ink/40">
                {track.mode === "audio" ? track.format?.toUpperCase() : `${track.resolution ?? ""}p`}
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2">
            <div className="flex items-center gap-5">
              <IconButton onClick={toggleShuffle} active={shuffle} title={t("player.shuffle")}>
                <Shuffle size={16} />
              </IconButton>
              <IconButton onClick={prev} title={t("player.previous")}>
                <SkipBack size={17} />
              </IconButton>
              <motion.button
                onClick={toggle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                className="play-control h-9 w-9"
                aria-label={t(isPlaying ? "mini.pause" : "mini.play")}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
              </motion.button>
              <IconButton onClick={next} title={t("player.next")}>
                <SkipForward size={17} />
              </IconButton>
              <IconButton onClick={cycleRepeat} active={repeat !== "off"} title={t("player.repeat")}>
                {repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </IconButton>
            </div>

            <div className="flex w-full items-center gap-2.5">
              <span className="w-9 text-right text-[10.5px] tabular-nums text-ink/35">{formatDuration(currentTime)}</span>
              <Slider
                aria-label={t("editor.preview")}
                value={currentTime}
                max={duration || 1}
                onChange={(v) => seek(v)}
                className="w-full"
              />
              <span className="w-9 text-[10.5px] tabular-nums text-ink/35">{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="flex w-32 flex-none items-center justify-end gap-2 text-ink/40">
            {isVideoTrack && (
              <IconButton onClick={toggleVideoVisible} active={videoVisible} title={videoVisible ? t("player.hideVideo") : t("player.showVideo")}>
                <MonitorPlay size={16} />
              </IconButton>
            )}
            <Volume2 size={15} />
            <div className="w-24">
              <SliderNumberFlow
                value={[Math.round(volume * 100)]}
                onValueChange={([v]) => setVolume(v / 100)}
                aria-label={t("player.volume")}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </div>
          </motion.footer>
        </>
      )}
    </AnimatePresence>
  );
}

function IconButton({ children, onClick, active, title }) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className={clsx(
        "icon-button",
        active ? "is-active" : "text-ink/45 hover:text-ink"
      )}
    >
      {children}
    </motion.button>
  );
}
