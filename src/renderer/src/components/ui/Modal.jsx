import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "../../i18n/index.js";

export default function Modal({ open, onClose, title, children, footer }) {
  const dialog = useRef(null);
  const previousFocus = useRef(document.activeElement);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  const { t } = useTranslation();
  useEffect(() => {
    if (open) return;
    const remember = event => {
      if (!event.target.closest('[role="dialog"]')) previousFocus.current = event.target;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // React autoFocus runs before effects, so retain the last focus outside
    // the dialog instead of accidentally recording its input as the opener.
    const previous = previousFocus.current;
    const frame = requestAnimationFrame(() => (dialog.current?.querySelector("input, textarea") || dialog.current?.querySelector("button, [tabindex='0']"))?.focus());
    function onKey(event) {
      if (event.key === "Escape") { event.preventDefault(); close.current?.(); }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll("button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex='0']") || [])].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [open]);
  return createPortal(<AnimatePresence>{open && <motion.div className="modal-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
    <div className="modal-overlay" onClick={onClose} />
    <motion.div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal-dialog" initial={{ y: 10, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 6, scale: .98 }} transition={{ duration: .22 }}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId}>{title}</h2><button type="button" onClick={onClose} className="icon-button" aria-label={t("studio.close")}><X size={18} /></button></div>
      <div>{children}</div>{footer && <div className="modal-footer">{footer}</div>}
    </motion.div>
  </motion.div>}</AnimatePresence>, document.body);
}
