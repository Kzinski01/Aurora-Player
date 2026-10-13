import { useEffect } from "react";
import { ListMusic } from "lucide-react";
import List from "../components/ui/List.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import QueueItem from "../components/queue/QueueItem.jsx";
import PlaylistDownloadItem from "../components/queue/PlaylistDownloadItem.jsx";
import useDownloadStore from "../store/useDownloadStore.js";
import logger from "../lib/logger.js";
import { useTranslation } from "../i18n/index.js";

export default function QueuePage() {
  const jobs = useDownloadStore((s) => s.jobs);
  const loadJobs = useDownloadStore((s) => s.loadJobs);
  const playlistDownloads = useDownloadStore((s) => s.playlistDownloads);
  const loadPlaylistDownloads = useDownloadStore((s) => s.loadPlaylistDownloads);
  const { t } = useTranslation();

  useEffect(() => {
    logger.info("Tela Fila montada", { jobsNaLojaAgora: jobs.length });
    loadJobs();
    loadPlaylistDownloads();
  }, [loadJobs, loadPlaylistDownloads]);

  const sorted = [...jobs].sort((a, b) => Number(a.status === "concluído") - Number(b.status === "concluído"));

  return (
    <div className="page-content">
      <div className="queue-summary">{[[jobs.filter(j => ["baixando", "convertendo", "aguardando"].includes(j.status)).length, "active"], [jobs.filter(j => j.status === "concluído").length, "completed"], [jobs.length, "total"]].map(([count, key]) => <div key={key}><strong>{count}</strong><span>{t(`studio.${key}`)}</span></div>)}</div>
      {sorted.length === 0 && playlistDownloads.length === 0 ? (
        <EmptyState icon={<ListMusic size={22} />} title={t("queue.emptyTitle")} subtitle={t("queue.emptySubtitle")} />
      ) : (
        <div className="flex flex-col gap-3">
          {playlistDownloads.map((group) => <PlaylistDownloadItem key={group.id} group={group} />)}
          <List>{sorted.map((job) => <QueueItem key={job.id} job={job} />)}</List>
        </div>
      )}
    </div>
  );
}
