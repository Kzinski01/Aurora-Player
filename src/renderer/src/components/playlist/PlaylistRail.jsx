import { useState } from "react";
import clsx from "clsx";
import { Plus, X, Upload, Pencil } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import Button from "../ui/Button.jsx";
import useLibraryStore from "../../store/useLibraryStore.js";
import useUIStore from "../../store/useUIStore.js";
import { useTranslation } from "../../i18n/index.js";

export default function PlaylistRail() {
  const { playlists, activeFilter, setActiveFilter, createPlaylist, renamePlaylist, deletePlaylist, importPlaylists } =
    useLibraryStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const { t, tn } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  // Deleting a playlist removes its .json from disk permanently — irreversible,
  // so it goes through a confirmation instead of firing on a single misclick.
  const [pendingDelete, setPendingDelete] = useState(null);
  // Renaming is reversible, but the chip is far too small to edit in place —
  // a modal gives the field room and keeps the rail from reflowing mid-edit.
  const [pendingRename, setPendingRename] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");

  async function confirmDelete() {
    if (!pendingDelete) return;
    await deletePlaylist(pendingDelete.id);
    pushToast({ tone: "info", message: t("playlistRail.deletedToast", { name: pendingDelete.name }) });
    setPendingDelete(null);
  }

  function startRename(playlist) {
    setPendingRename(playlist);
    setRenameDraft(playlist.name);
  }

  async function confirmRename() {
    if (!pendingRename) return;
    const trimmed = renameDraft.trim();
    // Nothing to do for an empty field or an unchanged name — closing quietly
    // beats a toast claiming a rename that never happened.
    if (!trimmed || trimmed === pendingRename.name) {
      setPendingRename(null);
      return;
    }
    const previous = pendingRename.name;
    const ok = await renamePlaylist(pendingRename.id, trimmed);
    setPendingRename(null);
    pushToast(
      ok
        ? { tone: "success", message: t("playlistRail.renamedToast", { from: previous, to: trimmed }) }
        : { tone: "error", message: t("playlistRail.renameFailed") }
    );
  }

  async function submitCreate() {
    if (name.trim()) await createPlaylist(name.trim());
    setName("");
    setCreating(false);
  }

  async function handleImport() {
    const res = await importPlaylists();
    if (res.imported > 0) {
      pushToast({ tone: "success", message: tn("playlistRail.importedToast", res.imported) });
    } else {
      pushToast({ tone: "info", message: t("playlistRail.noneImported") });
    }
  }

  return (
    // The browser forces overflow-y to "auto" (clipping) whenever overflow-x
    // isn't "visible", regardless of what overflow-y is set to — so the only
    // way to stop the active chip's glow shadow from being cut is padding
    // *inside* this scroll container, since clipping happens at the padding
    // edge, not the content edge. The chip's shadow (0 8px 18px -8px) is
    // offset downward, so it needs much more room below than above —
    // negative margins cancel the extra padding back out so this doesn't
    // push the rest of the page's layout around.
    <div className="playlist-rail">
      <Chip active={activeFilter === "__all"} onClick={() => setActiveFilter("__all")}>
        {t("playlistRail.all")}
      </Chip>
      <Chip active={activeFilter === "__favorites"} onClick={() => setActiveFilter("__favorites")}>
        {t("playlistRail.favorites")}
      </Chip>
      <div className="mx-1 h-4 w-px flex-none bg-ink/10" />
      {playlists.map((pl) => {
        const missing = pl.source === "file" ? pl.tracks.filter((track) => !track.libraryId).length : 0;
        return (
          <Chip
            key={pl.id}
            active={activeFilter === pl.id}
            onClick={() => setActiveFilter(pl.id)}
            onDelete={() => setPendingDelete(pl)}
            deleteTitle={t("playlistRail.deleteTitle")}
            onRename={() => startRename(pl)}
            renameTitle={t("playlistRail.renameTitle")}
          >
            {pl.name}
            {missing > 0 && <span className="ml-1.5 opacity-70">· {t("playlistRail.missingCount", { count: missing })}</span>}
          </Chip>
        );
      })}
      {creating ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submitCreate}
          onKeyDown={(e) => e.key === "Enter" && submitCreate()}
          placeholder={t("playlistRail.newPlaylistPlaceholder")}
          className="h-8 w-40 flex-none rounded-lg bg-ink/[0.05] border border-ink/[0.1] px-3.5 text-[12px] outline-none focus:border-accent/50"
        />
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex flex-none items-center gap-1 rounded-lg border border-dashed border-ink/[0.14] px-3.5 py-1.5 text-[12px] font-medium text-accent-soft transition-colors hover:bg-ink/[0.04]"
        >
          <Plus size={12} /> {t("playlistRail.newPlaylist")}
        </button>
      )}
      <button
        onClick={handleImport}
        title={t("playlistRail.importTitle")}
        className="flex flex-none items-center gap-1 rounded-lg border border-dashed border-ink/[0.14] px-3.5 py-1.5 text-[12px] font-medium text-accent-soft transition-colors hover:bg-ink/[0.04]"
      >
        <Upload size={12} /> {t("playlistRail.import")}
      </button>

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title={t("playlistRail.deleteTitle")}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              {t("playlistRail.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              {t("playlistRail.delete")}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink/70">{t("playlistRail.deleteConfirm", { name: pendingDelete?.name })}</p>
      </Modal>

      <Modal
        open={!!pendingRename}
        onClose={() => setPendingRename(null)}
        title={t("playlistRail.renameTitle")}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingRename(null)}>
              {t("playlistRail.cancel")}
            </Button>
            <Button size="sm" onClick={confirmRename}>
              {t("playlistRail.save")}
            </Button>
          </>
        }
      >
        <input
          autoFocus
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmRename()}
          maxLength={60}
          placeholder={t("playlistRail.renamePlaceholder")}
          className="aurora-input"
          aria-label={t("playlistRail.renamePlaceholder")}
        />
      </Modal>
    </div>
  );
}

function Chip({ active, onClick, onDelete, onRename, children, deleteTitle, renameTitle }) {
  const hasActions = Boolean(onDelete || onRename);
  return (
    <div
      className={clsx(
        "playlist-chip group flex flex-none items-center whitespace-nowrap pl-3.5 text-[12px] font-medium transition-colors",
        hasActions ? "pr-1" : "pr-3.5",
        active
          ? "is-active"
          : "hover:text-ink"
      )}
    >
      <button onClick={onClick} aria-pressed={active} className="py-2">
        {children}
      </button>
      {onRename && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          title={renameTitle}
          className={clsx(
            "ml-1 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-ink/10",
            active ? "text-accent-soft" : "text-ink/50 hover:text-ink"
          )}
        >
          <Pencil size={11} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title={deleteTitle}
          className={clsx(
            "ml-1 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-ink/10",
            active ? "text-accent-soft" : "text-ink/50 hover:text-rose-300"
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
