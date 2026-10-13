import { useTranslation } from "../../i18n/index.js";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import useUIStore from "../../store/useUIStore.js";

const icons = {
  warning: <AlertTriangle size={16} style={{ color: "rgb(var(--warning))" }} />,
  info: <Info size={16} className="text-accent-soft" />,
  success: <CheckCircle2 size={16} className="text-emerald-400" />,
  error: <AlertTriangle size={16} className="text-rose-400" />,
};

function ToastItem({ toast }) {
  const { t } = useTranslation();
  const dismiss = useUIStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="toast" role={toast.tone === "error" ? "alert" : "status"}
    >
      {icons[toast.tone]}
      <span className="toast-message">{toast.message}</span>
      <button
        aria-label={t("studio.close")}
        onClick={() => dismiss(toast.id)}
        className="text-ink/30 hover:text-ink/70 transition-colors"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export default function ToastStack() {
  const toasts = useUIStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-24 right-6 z-[80] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
