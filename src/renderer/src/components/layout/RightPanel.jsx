import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListMusic, X } from "lucide-react";
import useUIStore from "../../store/useUIStore.js";
import usePlayerStore from "../../store/usePlayerStore.js";
import EmptyState from "../ui/EmptyState.jsx";
import { useTranslation } from "../../i18n/index.js";

export default function RightPanel() {
  const open = useUIStore((s) => s.rightPanelOpen);
  const toggle = useUIStore(s => s.toggleRightPanel);
  const { queue, index } = usePlayerStore();
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = event => { if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) toggle(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, toggle]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="right-panel"
          aria-label={t("rightPanel.heading")}
        >
          <div className="w-full">
            <button className="icon-button float-right -mt-2" onClick={toggle} aria-label={t("studio.close")}><X size={16} /></button>
            <h3 className="mb-6 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/40">
              {t("rightPanel.heading")}
            </h3>
            {queue.length === 0 ? (
              <EmptyState icon={<ListMusic size={22} />} title={t("rightPanel.empty")} />
            ) : (
              <div className="flex flex-col gap-1">
                {queue.map((track, i) => (
                  <div
                    key={track.id}
                    className={`truncate rounded-lg px-2.5 py-2 text-[12.5px] ${
                      i === index ? "bg-accent/15 text-ink" : "text-ink/50"
                    }`}
                  >
                    {track.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
