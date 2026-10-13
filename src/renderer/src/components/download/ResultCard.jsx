import { useState } from "react";
import { Music, Video, Plus } from "lucide-react";
import clsx from "clsx";
import Thumbnail from "../ui/Thumbnail.jsx";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";
import Dropdown from "../ui/Dropdown.jsx";
import { formatDuration, formatUploadDate, detectPlatform } from "../../lib/format.js";
import useDownloadStore from "../../store/useDownloadStore.js";
import useUIStore from "../../store/useUIStore.js";
import { AUDIO_FORMAT_OPTIONS } from "../../lib/audioFormats.js";
import { useTranslation } from "../../i18n/index.js";

export default function ResultCard({ result }) {
  const updateResult = useDownloadStore((s) => s.updateResult);
  const addToQueue = useDownloadStore((s) => s.addToQueue);
  const analyzeUrls = useDownloadStore((s) => s.analyzeUrls);
  const pushToast = useUIStore((s) => s.pushToast);
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmPlaylist, setConfirmPlaylist] = useState(false);
  const { url, meta, mode, resolution, format } = result;
  // Instagram reels/posts are short clips — only video download makes sense
  // here, so the audio option (and the mode toggle itself, with nothing to
  // toggle) is hidden rather than offering a mode nobody asked for.
  const videoOnly = detectPlatform(url) === "instagram";

  async function handleAdd() {
    const res = await addToQueue(result);
    if (res.ok) {
      pushToast({ tone: "success", message: t("resultCard.addedToQueue") });
    } else {
      pushToast({ tone: "error", message: t("resultCard.addToQueueFailed", { error: res.error }) });
    }
  }

  function analyzeCurrentVideo() {
    const selected = new URL(url);
    selected.searchParams.delete("list");
    selected.searchParams.delete("index");
    analyzeUrls([selected.href], (_url, message) => pushToast({ tone: "error", message }));
  }
  const hasCurrentVideo = meta.isPlaylist && /^https?:\/\//.test(url) && new URL(url).searchParams.has("v");

  const resolutionOptions = meta.resolutions?.length
    ? meta.resolutions.map((r) => ({ value: String(r), label: `${r}p` }))
    : [{ value: "", label: t("resultCard.bestAvailable") }];

  return (
    <Card className={clsx("result-card", dropdownOpen && "z-30")} hover>
      <Thumbnail src={meta.thumbnail} className="result-cover" />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <div className="result-title line-clamp-2" title={meta.title}>{meta.title}</div>
          <div className="result-meta">
            {[meta.uploader, formatDuration(meta.duration), formatUploadDate(meta.uploadDate)]
              .filter(Boolean)
              .join(" · ")}
            {meta.isPlaylist && t("resultCard.playlistSuffix", { count: meta.entries })}
          </div>
        </div>

        <div className="result-controls">
          {!videoOnly && (
            <div className="segmented-control">
              {[
                { id: "video", key: "video", icon: Video },
                { id: "audio", key: "audio", icon: Music },
              ].map(({ id, key, icon: Icon }) => (
                <button
                  key={id}
                  aria-pressed={mode === id}
                  onClick={() => updateResult(url, { mode: id })}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                    mode === id ? "bg-ink/10 text-ink shadow-sm" : "text-ink/45 hover:text-ink/80"
                  )}
                >
                  <Icon size={13} />
                  {t(`resultCard.${key}`)}
                </button>
              ))}
            </div>
          )}

          {mode === "video" || videoOnly ? (
            <Dropdown
              className="w-32"
              value={String(resolution ?? "")}
              options={resolutionOptions}
              onChange={(v) => updateResult(url, { resolution: v })}
              onOpenChange={setDropdownOpen}
            />
          ) : (
            <Dropdown
              className="w-28"
              value={format}
              options={AUDIO_FORMAT_OPTIONS}
              onChange={(v) => updateResult(url, { format: v })}
              onOpenChange={setDropdownOpen}
            />
          )}

          {hasCurrentVideo && <Button size="sm" onClick={analyzeCurrentVideo}>{t("resultCard.onlyThisVideo")}</Button>}
          <Button size="sm" className="ml-auto" onClick={() => meta.isPlaylist ? setConfirmPlaylist(true) : handleAdd()}>
            <Plus size={14} />
            {t(meta.isPlaylist ? "resultCard.downloadPlaylist" : "resultCard.addToQueue")}
          </Button>
        </div>
      </div>
      <Modal
        open={confirmPlaylist}
        onClose={() => setConfirmPlaylist(false)}
        title={t("resultCard.playlistFound")}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmPlaylist(false)}>{t("resultCard.cancel")}</Button>
          <Button onClick={async () => { setConfirmPlaylist(false); await handleAdd(); }}>{t("resultCard.confirmPlaylist")}</Button>
        </>}
      >
        <p className="text-sm font-semibold">{meta.title}</p>
        <p className="mt-2 text-sm text-ink/60">{t("resultCard.playlistSuffix", { count: meta.entries })}</p>
        <ul className="mt-3 max-h-40 overflow-auto text-xs text-ink/60">
          {meta.items?.slice(0, 8).map((item) => <li key={item.position}>{String(item.position).padStart(3, "0")} - {item.title}</li>)}
        </ul>
      </Modal>
    </Card>
  );
}
