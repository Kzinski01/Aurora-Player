import { motion } from "framer-motion";
import useUIStore from "../../store/useUIStore.js";
import { PanelRight } from "lucide-react";
import { useTranslation } from "../../i18n/index.js";

// Every view that has a heading. Anything missing here silently falls back to
// the download heading, which is how the editor spent its first run announcing
// itself as "Baixar do YouTube".
const VIEWS = ["download", "queue", "library", "settings", "profile", "editor"];

export default function Topbar() {
  const view = useUIStore((s) => s.view);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const { t } = useTranslation();
  const panelOpen = useUIStore(s => s.rightPanelOpen);
  const key = VIEWS.includes(view) ? view : "download";

  return (
    <header className="topbar">
      <motion.div key={view} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        <h1 className="text-balance">{t(key === "download" ? "studio.downloadTitle" : `topbar.${key}.title`)}</h1>
        <p >{t(`topbar.${key}.subtitle`)}</p>
      </motion.div>

      <button
        onClick={toggleRightPanel}
        className="icon-button"
        aria-label={t("topbar.detailsPanel")}
        aria-expanded={panelOpen}
        title={t("topbar.detailsPanel")}
      >
        <PanelRight size={16} />
      </button>
    </header>
  );
}
