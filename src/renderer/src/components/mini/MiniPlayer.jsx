import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Pause, Play, Shuffle, SkipBack, SkipForward, X } from "lucide-react";
import clsx from "clsx";
import aurora from "../../lib/aurora.js";
import { formatDuration } from "../../lib/format.js";
import { translate } from "../../i18n/index.js";
import { applyAccent, DEFAULT_ACCENT } from "../../lib/accent.js";
import ShineBorder from "./ShineBorder.jsx";
import MarqueeText from "./MarqueeText.jsx";
import MiniProgress from "./MiniProgress.jsx";
import AudioSpectrum from "./AudioSpectrum.jsx";

const EMPTY_STATE = { hasTrack: false, theme: "dark" };
const SPRING = { type: "spring", stiffness: 500, damping: 26 };

// The mini player never touches a media element: every button posts a command
// to the main window, which owns playback, and every pixel it draws comes from
// the state that window publishes back. See hooks/useMiniPlayerBridge.js.
export default function MiniPlayer() {
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => aurora.onMiniState((incoming) => setState(incoming ?? EMPTY_STATE)), []);

  // Same mechanism the main window uses (App.jsx) so both read the identical
  // variables out of index.css — there is no separate mini-player theme.
  useEffect(() => {
    const theme = state.theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [state.theme]);

  // The custom accent has to be re-applied here too: this is a separate
  // window with its own document, so the variables the main window set on
  // its own <html> mean nothing to it.
  useEffect(() => {
    applyAccent(state.accentColor);
  }, [state.accentColor]);

  const t = (key) => translate(state.language, key);
  const send = (action, value) => aurora.sendMiniCommand({ action, value });
  const isLight = state.theme === "light";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <ShineBorder
        className="mini-card"
        borderRadius={16}
        borderWidth={1}
        duration={16}
        // Var-based so the shine follows a custom accent; the neon stays a
        // fixed brand constant, as it does everywhere else in the app.
        color={["rgb(var(--accent))", "rgb(var(--accent-deep))", "rgb(var(--accent-soft))"]}
        // Sized in the style prop, not with classes: the card must stay exactly
        // 350x108 inside a window that is deliberately larger (see
        // main/miniPlayer.js), and an inline dimension can't lose a specificity
        // tie to a utility class.
        style={{
          width: 350,
          height: 108,
          // Electron's transparent windows can't blur what's behind them, so the
          // "transparent black / transparent white" look has to be a real
          // translucent fill rather than a backdrop-filter.
          background: isLight ? "rgba(255, 255, 255, 0.82)" : "rgba(11, 12, 18, 0.78)",
          // Small and faint on purpose. The previous shadow reached ~46px from
          // the card into a 12px gutter, so the window clipped it and the cut
          // edges read as dim black borders framing the player. This one stays
          // within the gutter (2 + 6 - 1 = 7px at its furthest) and is light
          // enough to give lift without drawing a box.
          boxShadow: isLight
            ? "0 2px 6px -1px rgba(23, 21, 32, 0.18)"
            : "0 2px 6px -1px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div
          // Dragging anywhere on the card moves the window; double-clicking it
          // brings the full app back.
          style={{ WebkitAppRegion: "drag" }}
          onDoubleClick={() => aurora.restoreMainWindow()}
          // No bottom padding: the spectrum strip is flush with the card's
          // bottom edge, and overflow-hidden is what lets the rounded corners
          // clip it instead of it squaring them off.
          className="mini-content flex h-full w-full flex-col overflow-hidden pt-2 text-ink"
        >
          <div className="flex min-h-0 flex-1 items-center gap-2.5 px-2.5">
            <Thumbnail state={state} onOpen={() => aurora.restoreMainWindow()} title={t("mini.openApp")} />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <MarqueeText
                    key={state.id ?? "empty"}
                    text={state.hasTrack ? state.title : t("mini.nothingPlaying")}
                    className="text-[11.5px] font-semibold leading-tight"
                  />
                  <div className="truncate text-[9.5px] leading-tight text-ink/45">
                    {state.hasTrack ? state.uploader || state.subtitle : t("mini.openToStart")}
                  </div>
                </div>
                <button
                  style={{ WebkitAppRegion: "no-drag" }}
                  onClick={() => aurora.closeMiniPlayer()}
                  title={t("mini.hide")}
                  className="-mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full text-ink/30 transition-colors hover:bg-ink/[0.08] hover:text-ink/70"
                >
                  <X size={10} />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="w-6 flex-none text-right text-[8.5px] tabular-nums text-ink/35">
                  {formatDuration(state.currentTime ?? 0)}
                </span>
                <MiniProgress
                  value={state.currentTime ?? 0}
                  max={state.duration ?? 0}
                  onSeek={(v) => send("seek", v)}
                />
                <span className="w-6 flex-none text-[8.5px] tabular-nums text-ink/35">
                  {formatDuration(state.duration ?? 0)}
                </span>
              </div>

              <div className="flex items-center justify-between pr-0.5">
                <IconButton onClick={() => send("shuffle")} active={state.shuffle} title={t("mini.shuffle")}>
                  <Shuffle size={11} />
                </IconButton>
                <IconButton onClick={() => send("prev")} title={t("mini.previous")}>
                  <SkipBack size={12} />
                </IconButton>
                <motion.button
                  style={{ WebkitAppRegion: "no-drag" }}
                  onClick={() => send("toggle")}
                  title={state.isPlaying ? t("mini.pause") : t("mini.play")}
                  whileHover={{ scale: 1.07 }}
                  whileTap={{ scale: 0.9 }}
                  transition={SPRING}
                  className="play-control h-6 w-6"
                >
                  {state.isPlaying ? <Pause size={11} /> : <Play size={11} className="translate-x-[1px]" />}
                </motion.button>
                <IconButton onClick={() => send("next")} title={t("mini.next")}>
                  <SkipForward size={12} />
                </IconButton>
                <IconButton onClick={() => send("favorite")} active={state.favorite} title={t("mini.favorite")}>
                  <Heart size={11} fill={state.favorite ? "currentColor" : "none"} />
                </IconButton>
              </div>
            </div>
          </div>

          <AudioSpectrum
            isPlaying={Boolean(state.isPlaying)}
            hasTrack={Boolean(state.hasTrack)}
            theme={isLight ? "light" : "dark"}
            accentColor={state.accentColor}
          />
        </div>
      </ShineBorder>
    </div>
  );
}

function Thumbnail({ state, onOpen, title }) {
  return (
    <button
      style={{ WebkitAppRegion: "no-drag" }}
      onClick={onOpen}
      title={title}
      className="group relative h-[74px] w-[74px] flex-none overflow-hidden rounded-[12px] bg-ink/[0.06] ring-1 ring-inset ring-ink/[0.07]"
    >
      {/* Keyed on the track id so a track change cross-fades the two images
          instead of swapping the src underneath a single element. */}
      <AnimatePresence>
        {state.thumbnail && (
          <motion.img
            key={state.id}
            src={state.thumbnail}
            alt=""
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/25" />
    </button>
  );
}

function IconButton({ children, onClick, active, title }) {
  return (
    <motion.button
      style={{ WebkitAppRegion: "no-drag" }}
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.88 }}
      transition={SPRING}
      className={clsx(
        "flex h-[18px] w-[18px] items-center justify-center rounded-full transition-colors",
        active ? "text-accent-soft" : "text-ink/45 hover:text-ink"
      )}
    >
      {children}
    </motion.button>
  );
}
