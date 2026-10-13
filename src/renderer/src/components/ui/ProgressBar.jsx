import clsx from "clsx";
export default function ProgressBar({ value = 0, tone = "accent", className, label }) {
  const progress = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className={clsx("aurora-progress", tone === "danger" && "is-danger", className)}>
    <div className="aurora-progress-fill" style={{ transform: `scaleX(${progress})` }} />
  </div>;
}
