import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Library, DownloadCloud, FileOutput, RefreshCw, ListPlus, CheckSquare, X } from "lucide-react";
import clsx from "clsx";
import Input from "../components/ui/Input.jsx";
import List from "../components/ui/List.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Dropdown from "../components/ui/Dropdown.jsx";
import PlaylistRail from "../components/playlist/PlaylistRail.jsx";
import LibraryItem from "../components/playlist/LibraryItem.jsx";
import LibraryStatsCard from "../components/library/LibraryStatsCard.jsx";
import useLibraryStore from "../store/useLibraryStore.js";
import useUIStore from "../store/useUIStore.js";
import logger from "../lib/logger.js";
import { useTranslation } from "../i18n/index.js";

export default function LibraryPage() {
  const { t, tn } = useTranslation();
  const {
    search,
    setSearch,
    loadLibrary,
    loadPlaylists,
    resyncPlaylists,
    downloadMissingTracks,
    removePlaylistTrack,
    exportPlaylist,
    playlists,
    selectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    selectAllVisible,
    addSelectedToPlaylist,
    loadStats,
    stats,
  } = useLibraryStore();
  const visible = useLibraryStore((s) => s.visibleItems());
  const activePlaylist = useLibraryStore((s) => s.activePlaylist());
  const setView = useUIStore((s) => s.setView);
  const pushToast = useUIStore((s) => s.pushToast);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingMissing, setDownloadingMissing] = useState(false);
  const [targetPlaylistId, setTargetPlaylistId] = useState("");

  useEffect(() => {
    logger.info("Tela Biblioteca montada", {
      itemsNaLojaAgora: useLibraryStore.getState().library.length,
      visiveisAgora: visible.length,
    });
    loadLibrary();
    loadPlaylists();
    resyncPlaylists();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLibrary, loadPlaylists, resyncPlaylists, loadStats]);

  useEffect(() => {
    if (selectionMode && !targetPlaylistId && playlists.length > 0) setTargetPlaylistId(playlists[0].id);
  }, [selectionMode, targetPlaylistId, playlists]);

  const missingTracks = activePlaylist?.source === "file" ? activePlaylist.tracks.filter((t) => !t.libraryId) : [];

  async function handleDownloadMissing() {
    // Backend also guards against overlapping calls, but disabling the button
    // client-side is what actually stops a user's rapid double-click from
    // firing two requests before the first one's disabled state paints.
    if (downloadingMissing) return;
    setDownloadingMissing(true);
    try {
      const res = await downloadMissingTracks(activePlaylist.id);
      if (res.queued > 0) {
        pushToast({ tone: "success", message: tn("library.queuedToast", res.queued) });
        setView("queue");
      } else if (res.alreadyLinked > 0) {
        pushToast({ tone: "info", message: tn("library.alreadyLinkedToast", res.alreadyLinked) });
      } else {
        pushToast({ tone: "info", message: t("library.nothingToDownload") });
      }
    } finally {
      setDownloadingMissing(false);
    }
  }

  async function handleAddSelected() {
    if (!targetPlaylistId || selectedIds.length === 0) return;
    const res = await addSelectedToPlaylist(targetPlaylistId);
    if (res.added > 0) {
      pushToast({ tone: "success", message: tn("library.addedToPlaylistToast", res.added) });
    } else {
      pushToast({ tone: "info", message: t("library.noNewToAdd") });
    }
    // Track identity is unique by videoId — flag songs that were already
    // sitting in another playlist so the user knows before assuming it's new.
    if (res.duplicates?.length > 0) {
      const preview = res.duplicates
        .slice(0, 3)
        .map((d) => t("library.alreadyInPlaylists", { title: d.title, playlists: d.playlists.join(", ") }))
        .join("; ");
      const extra = res.duplicates.length > 3 ? t("library.andMore", { count: res.duplicates.length - 3 }) : "";
      pushToast({ tone: "info", duration: 5000, message: t("library.duplicatesToast", { list: `${preview}${extra}` }) });
    }
  }

  async function handleExport() {
    const res = await exportPlaylist(activePlaylist.id);
    if (res.path) {
      pushToast({ tone: "success", message: t("library.playlistExported") });
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadLibrary();
    await resyncPlaylists();
    await loadStats();
    setRefreshing(false);
    pushToast({ tone: "success", message: t("library.playlistUpdated") });
  }

  return (
    // pt-5: the active chip's shadow and the search input's focus glow both
    // extend above their own box — with no top padding here they'd get
    // clipped by <main>'s overflow-y-auto right at the scroll edge.
    <div className="page-content library-page">
      <LibraryStatsCard stats={stats} />
      <div className="library-toolbar">
        <div className="section-heading !mb-0"><h2>{activePlaylist?.name || t("nav.library")}</h2><span>{visible.length}</span></div>
        <div className="library-toolbar-actions flex-wrap">
          <Button
            variant={selectionMode ? "primary" : "ghost"}
            size="sm"
            onClick={() => (selectionMode ? exitSelectionMode() : enterSelectionMode())}
          >
            <ListPlus size={14} />
            {selectionMode ? t("library.cancelSelection") : t("library.addToPlaylist")}
          </Button>
          <Input
            icon={<Search size={14} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("library.searchPlaceholder")}
            aria-label={t("library.searchPlaceholder")}
            className="w-64 flex-none"
          />
        </div>
      </div>

      <PlaylistRail />

      <AnimatePresence initial={false}>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-20"
          >
            <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="text-[12.5px] text-ink/60">
                {tn("library.selected", selectedIds.length)}
              </div>
              <div className="library-toolbar-actions flex-wrap">
                <Button variant="ghost" size="sm" onClick={selectAllVisible}>
                  <CheckSquare size={14} />
                  {t("library.addAll")}
                </Button>
                <Dropdown
                  className="w-48"
                  value={targetPlaylistId}
                  options={
                    playlists.length > 0
                      ? playlists.map((p) => ({ value: p.id, label: p.name }))
                      : [{ value: "", label: t("library.noPlaylists") }]
                  }
                  onChange={setTargetPlaylistId}
                />
                <Button
                  size="sm"
                  onClick={handleAddSelected}
                  disabled={!targetPlaylistId || selectedIds.length === 0}
                >
                  <ListPlus size={14} />
                  {t("library.addCount", { count: selectedIds.length })}
                </Button>
                <Button variant="ghost" size="sm" onClick={exitSelectionMode} aria-label={t("library.cancelSelection")}>
                  <X size={14} />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {activePlaylist && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-semibold">{activePlaylist.name}</div>
              <div className="mt-0.5 text-[12px] text-ink/40">
                {missingTracks.length > 0
                  ? activePlaylist.sourceFile
                    ? tn("library.missingTracksImported", missingTracks.length, { file: activePlaylist.sourceFile })
                    : tn("library.missingTracks", missingTracks.length)
                  : tn("library.tracksInPlaylist", activePlaylist.tracks?.length ?? activePlaylist.trackIds?.length ?? 0)}
              </div>
            </div>
            <div className="flex flex-none gap-2">
              {activePlaylist.source === "file" && (
                <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw size={14} className={clsx(refreshing && "animate-spin")} />
                  {t("library.refresh")}
                </Button>
              )}
              {missingTracks.length > 0 && (
                <Button size="sm" onClick={handleDownloadMissing} disabled={downloadingMissing}>
                  <DownloadCloud size={14} />
                  {downloadingMissing ? t("library.downloading") : t("library.downloadMissing")}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleExport}>
                <FileOutput size={14} />
                {t("library.export")}
              </Button>
            </div>
          </div>
          {missingTracks.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-ink/[0.06] pt-3">
              {missingTracks.map((track) => (
                <div key={track.position} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 hover:bg-ink/[0.04]">
                  <span className="truncate text-[12px] text-ink/60">{track.title || track.url || t("library.untitledTrack")}</span>
                  <button
                    title={t("library.removeFromPlaylist")}
                    onClick={() => removePlaylistTrack(activePlaylist.id, track.position)}
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-ink/30 transition-colors hover:bg-ink/[0.08] hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={<Library size={22} />} title={t("library.emptyTitle")} subtitle={t("library.emptySubtitle")} />
      ) : (
        <List className="library-list">
          {visible.map((item, i) => (
            <LibraryItem key={item.id} item={item} index={i} visibleItems={visible} />
          ))}
        </List>
      )}
    </div>
  );
}
