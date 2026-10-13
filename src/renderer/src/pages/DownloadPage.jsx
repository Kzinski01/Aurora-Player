import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardPaste, Link2, X } from "lucide-react";
import Button from "../components/ui/Button.jsx";
import PixelCloud from "../components/ui/PixelCloud.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import ResultCard from "../components/download/ResultCard.jsx";
import useDownloadStore from "../store/useDownloadStore.js";
import useUIStore from "../store/useUIStore.js";
import { extractMediaUrls } from "../lib/format.js";
import { useTranslation } from "../i18n/index.js";

export default function DownloadPage() {
  const [text, setText] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const pending = useRef(false), input = useRef(null);
  const results = useDownloadStore(s => s.results);
  const analyzeUrls = useDownloadStore(s => s.analyzeUrls);
  const pushToast = useUIStore(s => s.pushToast);
  const { t } = useTranslation();
  const loading = state === "analyzing";
  async function handleAnalyze() {
    if (pending.current) return;
    const submitted = text, query = text.trim(), urls = extractMediaUrls(text);
    const invalid = !query ? t("download.needLinkOrQuery") : urls.length === 0 && /\b[a-z][a-z\d+.-]*:/i.test(query) ? t("download.invalidLink") : "";
    if (invalid) { setState("error"); setError(invalid); input.current?.focus(); return; }
    pending.current = true; setState("analyzing"); setError("");
    let failed = false;
    try {
      await analyzeUrls(urls.length ? urls : [`ytsearch1:${query}`], (url, message) => {
        failed = true;
        const detail = urls.length ? t("download.analyzeFailed", { url, message }) : t("download.noResultsFor", { query });
        setError(detail); pushToast({ tone: "error", message: detail });
      });
      setState(failed ? "error" : "success");
      if (!failed) setText(current => current === submitted ? "" : current);
    } catch (err) {
      setState("error"); setError(err.message || t("studio.failed"));
    } finally { pending.current = false; }
  }
  async function paste() {
    try { setText(await navigator.clipboard.readText()); setState("idle"); setError(""); input.current?.focus(); }
    catch { pushToast({ tone: "error", message: t("studio.clipboardError") }); }
  }
  return <div className="page-content download-page">
    <section className="download-hero"><div><div className="eyebrow">Aurora Desktop / {t("studio.workspace")}</div><h2>{t("studio.hero")}</h2><p>{t("studio.intro")}</p></div><div className="hero-orbit" aria-hidden="true"><PixelCloud state={state} /></div></section>
    <section className="link-composer" data-state={state} aria-busy={loading}>
      <label htmlFor="media-links" className="composer-label"><Link2 size={15} />{t("studio.links")}</label>
      <textarea ref={input} id="media-links" value={text} onChange={e => { setText(e.target.value); if (!loading) { setState("idle"); setError(""); } }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleAnalyze(); } }} rows={3} placeholder={t("download.placeholder")} aria-invalid={!!error} aria-describedby={error ? "analysis-feedback" : undefined} />
      <div className="composer-footer"><div className="composer-tools"><Button variant="subtle" size="sm" onClick={paste}><ClipboardPaste size={14} />{t("studio.paste")}</Button>{text && <button className="icon-button" title={t("studio.clear")} aria-label={t("studio.clear")} onClick={() => { setText(""); if (!loading) { setState("idle"); setError(""); } input.current?.focus(); }}><X size={15} /></button>}<span className="composer-hint">Ctrl + Enter</span></div>
        <Button className="analyze-button" onClick={handleAnalyze} disabled={loading}><PixelCloud state={state} />{loading ? t("studio.analyzing") : t("studio.analyze")}</Button>
      </div>
      <div aria-live="polite">{error ? <p id="analysis-feedback" className="mt-3 text-xs" style={{ color: "rgb(var(--error))" }}>{error}</p> : state === "success" && <p className="mt-3 text-xs" style={{ color: "rgb(var(--success))" }}>{t("studio.ready")}</p>}</div>
    </section>
    {loading && <div className="aurora-card flex gap-5 p-5" aria-label={t("studio.analyzing")}><Skeleton className="h-24 w-36" /><div className="flex flex-1 flex-col gap-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="mt-3 h-8 w-full" /></div></div>}
    {results.length > 0 ? <section><div className="section-heading"><h2>{t("studio.results")}</h2><span>{results.length}</span></div><div className="flex flex-col gap-3">{results.map(r => <motion.div key={r.url} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}><ResultCard result={r} /></motion.div>)}</div></section> : !loading && <section className="flow-guide">{[1,2,3].map(n => <div className="flow-step" key={n}><span className="flow-number">0{n}</span><div><h3>{t(`studio.step${n}`)}</h3><p>{t(`studio.detail${n}`)}</p></div></div>)}</section>}
  </div>;
}
