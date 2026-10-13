import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";

export default function Dropdown({ value, options, onChange, className, onOpenChange, label }) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const ref = useRef(null), trigger = useRef(null);
  const id = useId();
  const selected = options.find(o => o.value === value) ?? options[0];
  useLayoutEffect(() => {
    if (!open) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = Math.min(260, options.length * 38 + 12);
    setAbove(innerHeight - rect.bottom < height + 8 && rect.top > height + 8);
  }, [open, options.length]);
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector('[aria-selected="true"]')?.focus();
    const outside = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function onKeyDown(event) {
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (event.key === "Tab") setOpen(false);
    if (open && ["Enter", " "].includes(event.key) && document.activeElement?.getAttribute("role") === "option") {
      event.preventDefault();
      document.activeElement.click();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) { setOpen(true); return; }
    const nodes = [...ref.current.querySelectorAll('[role="option"]')];
    const index = nodes.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? nodes.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length;
    nodes[next]?.focus();
  }
  return <div ref={ref} className={clsx("relative", className)} onKeyDown={onKeyDown}>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen(v => !v)} className="aurora-input flex items-center justify-between gap-3 text-left">
      <span>{selected?.label}</span><ChevronDown size={14} className={clsx("transition-transform text-ink/50", open && "rotate-180")} />
    </button>
    <AnimatePresence>{open && <motion.ul id={id} role="listbox" aria-label={label || selected?.label} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: .14 }} className={clsx("dropdown-menu", above && "is-above")}>
      {options.map(o => <li key={o.value} role="presentation"><button type="button" role="option" aria-selected={o.value === selected?.value} className="dropdown-option" onClick={() => { onChange?.(o.value); setOpen(false); trigger.current?.focus(); }}>{o.label}{o.value === value && <Check size={13} />}</button></li>)}
    </motion.ul>}</AnimatePresence>
  </div>;
}
