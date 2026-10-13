import { motion, AnimatePresence } from "framer-motion";
import { Music4 } from "lucide-react";
import clsx from "clsx";
import useRichPresence from "../../hooks/useRichPresence.js";
import { useTranslation } from "../../i18n/index.js";

const SWAP = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

// Cross-fades whatever is inside whenever `swapKey` changes, without the
// surrounding layout moving: the outgoing and incoming children are stacked
// absolutely inside a parent that keeps its own size. Shared by the cover and
// the title/artist block so both transitions stay in step.
function FadeSwap({ swapKey, className, children }) {
  return (
    <div className={clsx("relative", className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={swapKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={SWAP}
          className="absolute inset-0"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Cover({ url, title }) {
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-ink/[0.06] text-ink/25">
        <Music4 size={22} />
      </div>
    );
  }
  return <img src={url} alt={title} className="h-full w-full rounded-lg object-cover" />;
}

// The bar is driven by a width transition rather than a per-frame redraw, so
// it keeps gliding smoothly between the media element's coarse "timeupdate"
// ticks (~4/s) instead of visibly stepping.
function ProgressBar({ percent }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-ink/[0.08]">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-deep"
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.25, ease: "linear" }}
      />
    </div>
  );
}

/**
 * A Discord-style "now playing" card for Aurora.
 *
 * Self-contained: it reads the current track straight from the player store,
 * so dropping <RichPresenceCard /> anywhere is enough. Every label is a prop
 * for reuse in other contexts (a different app name, another language).
 */
export default function RichPresenceCard({
  appName = "Aurora Player",
  sourceLabel,
  // Kept in English by default regardless of UI language, matching the
  // convention of the actual Discord button this card previews (Discord's own
  // "Play on..." buttons stay in English too, since the label lives inside
  // Discord's client, not this app's UI).
  actionLabel = "Play on Aurora Player",
  emptyLabel,
  className,
}) {
  const { t } = useTranslation();
  const presence = useRichPresence({ appName, sourceLabel });
  const resolvedEmptyLabel = emptyLabel ?? t("richPresence.empty");

  return (
    <div
      className={clsx(
        "aurora-card w-full max-w-[320px] p-4",
        className
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/35">{presence.sourceLabel}</div>

      <div className="mt-3 flex items-center gap-3">
        <FadeSwap swapKey={presence.trackKey} className="h-14 w-14 flex-none">
          <Cover url={presence.coverUrl} title={presence.title} />
        </FadeSwap>

        <FadeSwap swapKey={presence.trackKey} className="h-9 min-w-0 flex-1">
          {presence.hasMedia ? (
            <>
              <div className="truncate text-[13px] font-semibold leading-tight">{presence.title}</div>
              <div className="mt-0.5 truncate text-[11.5px] leading-tight text-ink/45">{presence.artist}</div>
            </>
          ) : (
            <div className="text-[12px] leading-tight text-ink/35">{resolvedEmptyLabel}</div>
          )}
        </FadeSwap>
      </div>

      {presence.hasMedia && (
        <>
          <div className="mt-3.5">
            <ProgressBar percent={presence.progressPercent} />
            <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-ink/35">
              <span>{presence.elapsedLabel}</span>
              <span>{presence.durationLabel}</span>
            </div>
          </div>

          <button
            onClick={presence.focusApp}
            disabled={!presence.canFocusApp}
            title={presence.canFocusApp ? undefined : t("richPresence.unavailable", { appName })}
            className={clsx(
              "mt-3.5 w-full rounded-lg py-2 text-[12px] font-semibold transition-colors",
              presence.canFocusApp
                ? "bg-ink/[0.07] text-ink/80 hover:bg-ink/[0.12] hover:text-ink"
                : "cursor-not-allowed bg-ink/[0.03] text-ink/25"
            )}
          >
            {actionLabel}
          </button>
        </>
      )}
    </div>
  );
}
