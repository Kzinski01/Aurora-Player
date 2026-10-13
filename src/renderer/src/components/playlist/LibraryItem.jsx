import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import clsx from "clsx";
import { Play, Pause, Heart, FolderOpen, Trash2, Check, RotateCcw, XCircle, DownloadCloud, Scissors } from "lucide-react";
import Thumbnail from "../ui/Thumbnail.jsx";
import Card from "../ui/Card.jsx";
import PlaylistMenu from "./PlaylistMenu.jsx";
import usePlayerStore from "../../store/usePlayerStore.js";
import useLibraryStore from "../../store/useLibraryStore.js";
import useUIStore from "../../store/useUIStore.js";
import useEditorStore from "../../store/useEditorStore.js";
import { formatShortDate } from "../../lib/format.js";
import aurora from "../../lib/aurora.js";
import { useTranslation } from "../../i18n/index.js";

export default function LibraryItem({ item, index, visibleItems }) {
  const { t } = useTranslation();
  const {
    toggleFavorite,
    removeFromLibrary,
    restoreLibraryItem,
    purgeLibraryItem,
    redownloadLibraryItem,
    selectionMode,
    selectedIds,
    toggleSelect,
  } = useLibraryStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const setView = useUIStore((s) => s.setView);
  const openInEditor = useEditorStore((s) => s.open);
  const current = usePlayerStore((s) => s.current());
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playFrom = usePlayerStore((s) => s.playFrom);
  const toggle = usePlayerStore((s) => s.toggle);

  // Loading the file's real duration takes an ffprobe round-trip, so the editor
  // is opened first and fills itself in — navigating only once it had the data
  // would leave the click feeling unresponsive.
  function openEditor() {
    openInEditor(item);
    setView("editor");
  }

  async function handleRedownload() {
    const res = await redownloadLibraryItem(item.id);
    pushToast(
      res.queued
        ? { tone: "success", message: t("libraryItem.redownloadQueued", { title: item.title }) }
        : { tone: "error", message: t("libraryItem.redownloadFailed") }
    );
  }

  const isCurrent = current?.id === item.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const removed = !!item.removed;
  // The file can vanish straight from disk (moved/deleted outside the app)
  // without the user ever pressing "Remover" — flagged fresh on every
  // library read (see libraryStore.annotateLibrary) rather than persisted,
  // so it self-corrects if the file comes back.
  const fileMissing = !removed && !!item.fileMissing;
  const gone = removed || fileMissing;
  const checked = selectedIds.includes(item.id);

  function handleCardClick(e) {
    if (!selectionMode || gone) return;
    toggleSelect(item.id, index, e.shiftKey);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={clsx("relative", menuOpen && "z-30")}
    >
      <Card
        onClick={handleCardClick}
        className={clsx(
          "library-row flex items-center gap-3.5 transition-opacity duration-300",
          isCurrent && "ring-1 ring-accent/40",
          selectionMode && !gone && "cursor-pointer",
          gone && "opacity-65"
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {selectionMode && !gone ? (
            <motion.button
              type="button" role="checkbox" aria-checked={checked} aria-label={item.title}
              onClick={e => { e.stopPropagation(); toggleSelect(item.id, index, e.shiftKey); }}
              key="checkbox"
              initial={{ opacity: 0, scale: 0.5, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 36 }}
              exit={{ opacity: 0, scale: 0.5, width: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              className={clsx(
                "flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 transition-colors",
                checked ? "border-accent bg-accent text-white" : "border-ink/20 text-transparent"
              )}
            >
              <Check size={15} />
            </motion.button>
          ) : (
            <motion.button
              key="play"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              whileHover={!gone ? { scale: 1.08 } : {}}
              whileTap={!gone ? { scale: 0.9 } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              disabled={gone}
              onClick={(e) => {
                e.stopPropagation();
                isCurrent ? toggle() : playFrom(visibleItems, index);
              }}
              className={clsx("library-play icon-button h-9 w-9", isCurrent && "is-active")}
              aria-label={t(isCurrent && isPlaying ? "mini.pause" : "mini.play")}
            >
              {isCurrent && isPlaying ? <Pause size={14} /> : <Play size={14} className="translate-x-[1px]" />}
            </motion.button>
          )}
        </AnimatePresence>

        <Thumbnail src={item.thumbnail} className="h-12 w-12" />

        <div className="min-w-0 flex-1">
          <div className={clsx("truncate text-[13px] font-semibold", isCurrent && "text-accent-soft")}>{item.title}</div>
          <div className="truncate text-[11.5px] text-ink/40">
            {[
              item.mode === "audio" ? item.format?.toUpperCase() : `${item.resolution ?? ""}p`,
              removed ? t("libraryItem.removed") : fileMissing ? t("libraryItem.fileMissing") : formatShortDate(item.downloadedAt),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        {removed ? (
          <>
            <ActionButton title={t("libraryItem.redownload")} onClick={handleRedownload}>
              <DownloadCloud size={13} />
            </ActionButton>
            <ActionButton title={t("libraryItem.restore")} onClick={() => restoreLibraryItem(item.id)}>
              <RotateCcw size={13} />
            </ActionButton>
            <ActionButton title={t("libraryItem.purge")} onClick={() => purgeLibraryItem(item.id)}>
              <XCircle size={13} />
            </ActionButton>
          </>
        ) : fileMissing ? (
          <>
            <ActionButton title={t("libraryItem.redownload")} onClick={handleRedownload}>
              <DownloadCloud size={13} />
            </ActionButton>
            <ActionButton title={t("libraryItem.removeMissing")} onClick={() => purgeLibraryItem(item.id)}>
              <XCircle size={13} />
            </ActionButton>
          </>
        ) : (
          !selectionMode && (
            <>
              <PlaylistMenu trackId={item.id} onOpenChange={setMenuOpen} />

              <ActionButton title={t("libraryItem.trim")} onClick={openEditor}>
                <Scissors size={13} />
              </ActionButton>
              <ActionButton title={t("libraryItem.favorite")} active={item.favorite} onClick={() => toggleFavorite(item.id)}>
                <Heart size={13} fill={item.favorite ? "currentColor" : "none"} />
              </ActionButton>
              <ActionButton title={t("libraryItem.openFolder")} onClick={() => aurora.openPath(item.folder)}>
                <FolderOpen size={13} />
              </ActionButton>
              <ActionButton title={t("libraryItem.remove")} onClick={() => removeFromLibrary(item.id)}>
                <Trash2 size={13} />
              </ActionButton>
            </>
          )
        )}
      </Card>
    </motion.div>
  );
}

function ActionButton({ children, active, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className={clsx(
        "icon-button",
        active ? "text-accent-soft" : "text-ink/50 hover:text-ink"
      )}
      aria-label={props.title}
      {...props}
    >
      {children}
    </motion.button>
  );
}
