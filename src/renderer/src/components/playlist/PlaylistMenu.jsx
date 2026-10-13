import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, Check, Plus } from "lucide-react";
import useLibraryStore from "../../store/useLibraryStore.js";
import useUIStore from "../../store/useUIStore.js";
import { useTranslation } from "../../i18n/index.js";

export default function PlaylistMenu({ trackId, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef(null);
  const { playlists, togglePlaylistTrack, createPlaylist } = useLibraryStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const { t } = useTranslation();
  useLayoutEffect(() => {
    if (!open) return;
    const rect = ref.current.getBoundingClientRect();
    const height = Math.min(320, playlists.length * 38 + 70);
    setAbove(innerHeight - rect.bottom < height + 8 && rect.top > height + 8);
  }, [open, playlists.length]);

  async function handleToggle(playlistId) {
    const res = await togglePlaylistTrack(playlistId, trackId);
    if (res?.duplicateOf?.length > 0) {
      pushToast({
        tone: "info",
        message: t("playlistMenu.alreadyIn", { title: res.trackTitle, playlists: res.duplicateOf.join(", ") }),
      });
    }
  }

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function submitCreate() {
    if (name.trim()) {
      const pl = await createPlaylist(name.trim());
      if (pl) await handleToggle(pl.id);
    }
    setName("");
    setCreating(false);
  }

  return (
    <div ref={ref} className="relative" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); ref.current?.querySelector("button")?.focus(); } }}>
      <IconTrigger expanded={open} onClick={() => setOpen((v) => !v)} title={t("playlistMenu.addToPlaylist")} />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={`playlist-menu${above ? " is-above" : ""}`}
          >
            {playlists.length === 0 && !creating && (
              <div className="px-2.5 py-2 text-[12px] text-ink/35">{t("playlistMenu.empty")}</div>
            )}
            {playlists.map((pl) => {
              const checked = pl.trackIds.includes(trackId);
              return (
                <button
                  key={pl.id}
                  role="checkbox" aria-checked={checked}
                  onClick={() => handleToggle(pl.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-ink/70 transition-colors hover:bg-ink/[0.06] hover:text-ink"
                >
                  <span
                    className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                      checked ? "border-accent bg-accent" : "border-ink/20"
                    }`}
                  >
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <span className="truncate">{pl.name}</span>
                </button>
              );
            })}

            <div className="mt-1 border-t border-ink/[0.06] pt-1.5">
              {creating ? (
                <div className="flex gap-1.5 px-1">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitCreate()}
                    placeholder={t("playlistMenu.newPlaylistPlaceholder")}
                    className="h-7 min-w-0 flex-1 rounded-md bg-ink/[0.06] border border-ink/[0.1] px-2 text-[11.5px] outline-none focus:border-accent/50"
                  />
                  <button onClick={submitCreate} className="rounded-md bg-accent px-2 text-[11px] font-semibold text-white">
                    {t("playlistMenu.create")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-accent-soft transition-colors hover:bg-ink/[0.06]"
                >
                  <Plus size={13} /> {t("playlistMenu.newPlaylist")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconTrigger({ onClick, title, expanded }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      title={title}
      aria-label={title} aria-expanded={expanded}
      className="icon-button"
    >
      <ListPlus size={13} />
    </motion.button>
  );
}
