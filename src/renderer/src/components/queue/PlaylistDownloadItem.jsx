import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import aurora from "../../lib/aurora.js";
import { useTranslation } from "../../i18n/index.js";

export default function PlaylistDownloadItem({ group }) {
  const { t } = useTranslation();
  return (
    <Card className="playlist-download">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{group.title}</div>
          <div className="text-xs text-ink/50">{t("playlistDownload.itemCount", { index: group.currentIndex, total: group.total })}</div>
        </div>
        {group.status === "baixando" && <Button size="sm" onClick={() => aurora.cancelPlaylistDownload(group.id)}>{t("queueItem.cancel")}</Button>}
      </div>
      {group.currentTitle && <div className="mt-2 truncate text-xs text-ink/60">{group.currentTitle}</div>}
      <div className="mt-3 text-xs text-ink/50">{t("playlistDownload.itemProgress")}</div>
      <ProgressBar value={group.itemProgress} />
      <div className="playlist-progress-head"><span className="text-xs text-ink/60">{t("playlistDownload.totalProgress")}</span><strong>{Math.round((group.totalProgress || 0) * 100)}<span className="text-sm text-ink/50">%</span></strong></div>
      <ProgressBar value={group.totalProgress} />
      <div className="mt-2 text-xs text-ink/50">
        {t("playlistDownload.summary", { completed: group.completed, skipped: group.skipped.length, total: group.total })}
        {group.speed && ` · ${group.speed}`}{group.eta && ` · ETA ${group.eta}`}{group.sizeText && ` · ${group.sizeText}`}
      </div>
      {group.status !== "baixando" && <div className="mt-2 text-xs font-semibold">{t(`queueItem.status.${group.status}`)}</div>}
      {group.skipped.length > 0 && group.status !== "baixando" && (
        <ul className="mt-2 max-h-24 overflow-auto text-xs text-rose-300">
          {group.skipped.map((item) => <li key={item.position}>{item.position}. {item.title}: {item.reason}</li>)}
        </ul>
      )}
    </Card>
  );
}
