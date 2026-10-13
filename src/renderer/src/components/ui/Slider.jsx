export default function Slider({ value, min = 0, max = 100, onChange, className, style, ...props }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange?.(Number(e.target.value))}
      className={className}
      style={{ "--range-fill": `${Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100))}%`, ...style }}
      {...props}
    />
  );
}
