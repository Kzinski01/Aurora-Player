import { motion } from "framer-motion";
import clsx from "clsx";
import { Pause, Play, X, FolderOpen, Trash2 } from "lucide-react";
import Thumbnail from "../ui/Thumbnail.jsx";
import Card from "../ui/Card.jsx";
import ProgressBar from "../ui/ProgressBar.jsx";
import aurora from "../../lib/aurora.js";
import useDownloadStore from "../../store/useDownloadStore.js";
import { useTranslation } from "../../i18n/index.js";

const statusTone = {
  aguardando: "bg-ink/[0.08] text-ink/60",
  pausado: "bg-ink/[0.08] text-ink/60",
  baixando: "bg-accent/15 text-accent-soft",
  convertendo: "bg-accent/15 text-accent-soft",
  concluído: "bg-emerald-500/15 text-emerald-300",
  erro: "bg-rose-500/15 text-rose-300",
  cancelado: "bg-rose-500/15 text-rose-300",
};

export default function QueueItem({ job }) {
  const removeJob = useDownloadStore((s) => s.removeJob);
  const { t } = useTranslation();
  const pausable = ["baixando", "aguardando"].includes(job.status);
  const resumable = job.status === "pausado" || job.status === "erro";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="queue-card">
        <Thumbnail src={job.thumbnail} className="queue-cover" />
        <div className="queue-body">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold">{job.title}</div>
            <div className="truncate text-[11.5px] text-ink/40">
              {job.mode === "audio"
                ? t("queueItem.audioLabel", { format: job.audioFormat?.toUpperCase() })
                : job.resolution
                  ? t("queueItem.videoLabelRes", { resolution: job.resolution })
                  : t("queueItem.videoLabel")}
            </div>
          </div>
          <span className={clsx("status-badge", statusTone[job.status])}>
            {t(`queueItem.status.${job.status}`)}
          </span>
        </div>

        <div className="flex items-center gap-3"><ProgressBar className="flex-1" label={job.title} value={job.progress || 0} tone={job.status === "erro" ? "danger" : "accent"} /><span className="text-xs tabular-nums text-ink/60">{Math.round((job.progress || 0) * 100)}%</span></div>

        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-[11px] text-ink/35 tabular-nums">
            {job.speed && <span>{job.speed}</span>}
            {job.eta && <span>{t("queueItem.eta", { eta: job.eta })}</span>}
            {job.sizeText && <span>{job.sizeText}</span>}
          </div>

          <div className="flex gap-1.5">
            {pausable && (
              <ActionButton title={t("queueItem.pause")} onClick={() => aurora.pauseDownload(job.id)}>
                <Pause size={13} />
              </ActionButton>
            )}
            {resumable && (
              <ActionButton title={t("queueItem.resume")} onClick={() => aurora.resumeDownload(job.id)}>
                <Play size={13} />
              </ActionButton>
            )}
            <ActionButton title={t("queueItem.cancel")} onClick={() => aurora.cancelDownload(job.id)}>
              <X size={13} />
            </ActionButton>
            <ActionButton title={t("queueItem.openFolder")} onClick={() => aurora.openPath(job.outputDir)}>
              <FolderOpen size={13} />
            </ActionButton>
            <ActionButton title={t("queueItem.remove")} onClick={() => removeJob(job.id)}>
              <Trash2 size={13} />
            </ActionButton>
          </div>
        </div>

        {job.error && <div className="text-[11px] text-rose-300/80">{job.error}</div>}
        </div>
      </Card>
    </motion.div>
  );
}

function ActionButton({ children, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      className="icon-button"
      aria-label={props.title}
      {...props}
    >
      {children}
    </motion.button>
  );
}
