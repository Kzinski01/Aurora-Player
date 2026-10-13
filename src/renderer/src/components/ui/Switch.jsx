export default function Switch({ checked, onChange, label, ...props }) {
  return <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
    <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange?.(!checked)} className="aurora-switch" {...props}><span /></button>
    {label && <span className="text-[13px] text-ink/70">{label}</span>}
  </label>;
}
