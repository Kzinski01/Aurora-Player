import { ArrowLeft, Scissors, FolderOpen, X, Loader2, Play, Pause } from "lucide-react";
import ProgressBar from "../components/ui/ProgressBar.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import TrimTimeline from "../components/editor/TrimTimeline.jsx";
import ExportOptions from "../components/editor/ExportOptions.jsx";
import useClipPreview from "../hooks/useClipPreview.js";
import useEditorStore from "../store/useEditorStore.js";
import useUIStore from "../store/useUIStore.js";
import aurora from "../lib/aurora.js";
import { formatBytes, formatDuration } from "../lib/format.js";
import { useTranslation } from "../i18n/index.js";

// Composition only: the preview lives in useClipPreview, the output controls in
// ExportOptions, and the trim range in TrimTimeline. What is left here is how
// those three fit together on the page.
export default function EditorPage() {
  const { t } = useTranslation();
  const setView = useUIStore((s) => s.setView);
  const pushToast = useUIStore((s) => s.pushToast);

  const {
    item, info, loading, loadError, exportError,
    start, end, target, precise, audioFormat, fps, width,
    exporting, progress, result,
    setStart, setEnd, updateSettings, exportClip, cancelExport, close,
  } = useEditorStore();

  const preview = useClipPreview({ filePath: item?.filePath, start, end });
  const clipSeconds = Math.max(0, end - start);
  const problem = loadError || exportError;

  function goBack() {
    preview.pause();
    close();
    setView("library");
  }

  async function handleExport() {
    const exported = await exportClip();
    pushToast(
      exported
        ? { tone: "success", message: t("editor.exportSuccess", { size: formatBytes(exported.sizeBytes) }) }
        : { tone: "error", message: useEditorStore.getState().exportError || t("editor.exportFailed") }
    );
  }

  if (!item) {
    return (
      <div className="page-content">
        <EmptyState icon={<Scissors size={22} />} title={t("editor.noneTitle")} subtitle={t("editor.noneDescription")} />
      </div>
    );
  }

  return (
    <div className="page-content editor-page">
      <header className="flex items-center gap-3">
        <Button variant="subtle" size="sm" onClick={goBack}>
          <ArrowLeft size={14} /> {t("editor.back")}
        </Button>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{item.title}</div>
          <div className="text-[11.5px] text-ink/40">
            {loading
              ? t("editor.reading")
              : info
                ? t("editor.sourceInfo", {
                    duration: formatDuration(info.duration),
                    size: formatBytes(info.sizeBytes),
                  })
                : ""}
          </div>
        </div>
      </header>

      {problem && !exporting && (
        <Card className="border border-rose-500/20 bg-rose-500/[0.06] p-4 text-[13px] text-rose-200">{problem}</Card>
      )}

      <Card className="editor-workbench overflow-hidden">
        {info?.hasVideo ? (
          <div className="editor-preview mb-5 flex justify-center overflow-hidden rounded-xl">
            <video ref={preview.mediaRef} src={preview.url ?? undefined} className="max-h-[280px] w-auto" playsInline />
          </div>
        ) : (
          <audio ref={preview.mediaRef} src={preview.url ?? undefined} className="hidden" />
        )}

        <div className="mb-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={preview.toggle} disabled={!preview.url}>
            {preview.playing ? <Pause size={13} /> : <Play size={13} />}
            {preview.playing ? t("editor.pausePreview") : t("editor.preview")}
          </Button>
          <div className="text-[12px] tabular-nums text-ink/50">
            {t("editor.selection", {
              start: formatDuration(start),
              end: formatDuration(end),
              duration: formatDuration(clipSeconds),
            })}
          </div>
        </div>

        <TrimTimeline
          duration={info?.duration ?? 0}
          start={start}
          end={end}
          playhead={preview.playhead}
          onChangeStart={setStart}
          onChangeEnd={setEnd}
          onSeek={preview.seek}
        />
      </Card>

      <ExportOptions
        settings={{ target, precise, audioFormat, fps, width }}
        source={info}
        clipSeconds={clipSeconds}
        onChange={updateSettings}
      />

      <div className="flex items-center gap-3">
        <Button onClick={handleExport} disabled={exporting || loading || clipSeconds <= 0}>
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
          {exporting ? t("editor.exporting", { percent: Math.round(progress * 100) }) : t("editor.export")}
        </Button>

        {exporting && (
          <Button variant="ghost" size="sm" onClick={cancelExport}>
            <X size={13} /> {t("editor.cancel")}
          </Button>
        )}

        {result && !exporting && (
          <Button variant="ghost" size="sm" onClick={() => aurora.openPath(result.path)}>
            <FolderOpen size={13} /> {t("editor.openResult", { size: formatBytes(result.sizeBytes) })}
          </Button>
        )}
      </div>

      {exporting && <ProgressBar value={progress} label={t("editor.export")} />}
    </div>
  );
}
