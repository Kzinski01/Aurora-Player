import { useState } from "react";
import clsx from "clsx";
import { Download, ListMusic, Library, Settings, User, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import useUIStore from "../../store/useUIStore.js";
import useDownloadStore from "../../store/useDownloadStore.js";
import useProfileStore from "../../store/useProfileStore.js";
import PixelCloud from "../ui/PixelCloud.jsx";
import { useTranslation } from "../../i18n/index.js";

const items = [{ id: "download", icon: Download }, { id: "queue", icon: ListMusic }, { id: "library", icon: Library }];
export default function Sidebar() {
  const view = useUIStore(s => s.view), setView = useUIStore(s => s.setView);
  const jobs = useDownloadStore(s => s.jobs);
  const profile = useProfileStore(s => s.profile);
  const avatarUrl = useProfileStore(s => s.avatarUrl);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("aurora.sidebar.collapsed") === "true");
  const { t } = useTranslation();
  const activeCount = jobs.filter(j => ["baixando", "convertendo", "aguardando"].includes(j.status)).length;
  function toggle() { setCollapsed(value => { localStorage.setItem("aurora.sidebar.collapsed", String(!value)); return !value; }); }
  const navItem = ({ id, icon: Icon }) => <button key={id} title={t(`nav.${id}`)} aria-label={t(`nav.${id}`)} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)} className={clsx("nav-item", view === id && "is-active")}>
    <Icon size={18} /><span className="nav-label">{t(`nav.${id}`)}</span>{id === "queue" && activeCount > 0 && <span className="nav-count">{activeCount}</span>}
  </button>;
  return <aside className={clsx("sidebar", collapsed && "is-collapsed")}>
    <div className="brand"><PixelCloud className="brand-mark" /><span className="brand-word">aurora<span className="text-accent-soft">.</span></span></div>
    <div className="nav-caption">{t("studio.workspace")}</div>
    <nav className="nav-list" aria-label={t("studio.workspace")}>{items.map(navItem)}</nav>
    <div className="nav-footer">
      <nav className="nav-list">{navItem({ id: "settings", icon: Settings })}
      <button className="sidebar-profile" title={t("nav.profile")} aria-label={t("nav.profile")} aria-current={view === "profile" ? "page" : undefined} onClick={() => setView("profile")}>
        <span className="sidebar-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={16} />}</span>
        <span className="profile-copy min-w-0"><span className="block truncate font-medium">{profile?.username || t("nav.profile")}</span><small>{t("nav.profile")}</small></span>
      </button>
      </nav>
      <button type="button" className="nav-item collapse-navigation" title={t(collapsed ? "studio.expand" : "studio.collapse")} aria-label={t(collapsed ? "studio.expand" : "studio.collapse")} aria-expanded={!collapsed} onClick={toggle}>
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}<span className="nav-label text-[11px]">{t("studio.collapse")}</span>
      </button>
    </div>
  </aside>;
}
