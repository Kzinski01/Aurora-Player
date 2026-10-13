import clsx from "clsx";
import Card from "../ui/Card.jsx";
import { AUDIO_FORMATS } from "../../lib/audioFormats.js";
import { estimateAnimatedSize } from "../../lib/clipEstimate.js";
import { formatBytes } from "../../lib/format.js";
import { useTranslation } from "../../i18n/index.js";

const FPS_CHOICES = [10, 15, 20, 25];
const WIDTH_CHOICES = [320, 480, 640, 720];

// Past this, a GIF stops being something you can paste anywhere and starts
// being a file people wait on — the point where suggesting WebP is worth the
// interruption.
const LARGE_ANIMATION_BYTES = 12 * 1024 * 1024;

// Every control that shapes the exported file. Split out of EditorPage so that
// page reads as "preview, options, export" rather than as one function holding
// all three.
export default function ExportOptions({ settings, source, clipSeconds, onChange }) {
  const { t } = useTranslation();
  const { target, precise, audioFormat, fps, width } = settings;
  const canProduceVideo = Boolean(source?.hasVideo);
  const isAnimation = target === "gif" || target === "webp";

  const scaledHeight = source?.width ? Math.round((width * source.height) / source.width) : 0;
  const estimatedBytes = isAnimation
    ? estimateAnimatedSize({ target, width, height: scaledHeight, fps, duration: clipSeconds })
    : 0;
  const isLarge = estimatedBytes > LARGE_ANIMATION_BYTES;

  return (
    <Card className="export-options">
      <Field label={t("editor.outputTitle")}>
        <div className="flex flex-wrap gap-2">
          <Choice active={target === "video"} disabled={!canProduceVideo} onClick={() => onChange({ target: "video" })}>
            {t("editor.targetVideo")}
          </Choice>
          <Choice active={target === "audio"} onClick={() => onChange({ target: "audio" })}>
            {t("editor.targetAudio")}
          </Choice>
          <Choice active={target === "gif"} disabled={!canProduceVideo} onClick={() => onChange({ target: "gif" })}>
            GIF
          </Choice>
          <Choice active={target === "webp"} disabled={!canProduceVideo} onClick={() => onChange({ target: "webp" })}>
            WebP
          </Choice>
        </div>
      </Field>

      {target === "video" && (
        <Field label={t("editor.cutModeTitle")} hint={precise ? t("editor.preciseHint") : t("editor.fastHint")}>
          <div className="flex gap-2">
            <Choice active={precise} onClick={() => onChange({ precise: true })}>{t("editor.precise")}</Choice>
            <Choice active={!precise} onClick={() => onChange({ precise: false })}>{t("editor.fast")}</Choice>
          </div>
        </Field>
      )}

      {target === "audio" && (
        <Field
          label={t("editor.audioFormatTitle")}
          hint={audioFormat ? t("editor.convertHint") : t("editor.keepFormatHint")}
        >
          <div className="flex flex-wrap gap-2">
            <Choice active={!audioFormat} onClick={() => onChange({ audioFormat: null })}>
              {t("editor.keepFormat")}
            </Choice>
            {AUDIO_FORMATS.map((format) => (
              <Choice key={format} active={audioFormat === format} onClick={() => onChange({ audioFormat: format })}>
                {format.toUpperCase()}
              </Choice>
            ))}
          </div>
        </Field>
      )}

      {isAnimation && (
        <>
          <Field label={t("editor.fpsTitle")}>
            <div className="flex gap-2">
              {FPS_CHOICES.map((value) => (
                <Choice key={value} active={fps === value} onClick={() => onChange({ fps: value })}>
                  {value}
                </Choice>
              ))}
            </div>
          </Field>

          <Field label={t("editor.widthTitle")}>
            <div className="flex gap-2">
              {WIDTH_CHOICES.map((value) => (
                <Choice key={value} active={width === value} onClick={() => onChange({ width: value })}>
                  {value}px
                </Choice>
              ))}
            </div>
          </Field>

          <div
            className={clsx(
              "rounded-lg px-3 py-2 text-[11.5px]",
              isLarge ? "bg-amber-500/10 text-amber-200" : "bg-ink/[0.04] text-ink/50"
            )}
          >
            {t("editor.sizeEstimate", { size: formatBytes(estimatedBytes) })}
            {target === "gif" && isLarge && ` — ${t("editor.tryWebp")}`}
          </div>
        </>
      )}
    </Card>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-ink/70">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[11px] text-ink/40">{hint}</div>}
    </div>
  );
}

function Choice({ active, disabled, onClick, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        "editor-choice rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-35",
        active ? "is-active" : "hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
