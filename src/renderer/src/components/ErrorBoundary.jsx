import { Component } from "react";
import { AlertTriangle } from "lucide-react";
import logger from "../lib/logger.js";
import { useTranslation } from "../i18n/index.js";

// The boundary itself is a class component (getDerivedStateFromError requires
// it) and can't call hooks — this tiny wrapper is what lets the fallback text
// use useTranslation() instead of hardcoding one language into a class field.
function ErrorFallback({ message }) {
  const { t } = useTranslation();
  return (
    <div className="mx-8 mt-6 flex flex-col items-center gap-3 rounded-xl2 border border-rose-500/20 bg-rose-500/[0.04] py-14 text-center">
      <AlertTriangle size={22} className="text-rose-400" />
      <div className="text-[13px] font-medium text-ink/70">{t("errors.boundaryTitle")}</div>
      <div className="max-w-sm text-[12px] text-ink/40">{t("errors.boundaryDetail", { message })}</div>
    </div>
  );
}

// Without this, a render-time exception in any page silently blanks out the
// content area with no visible error and no log entry — exactly the bug
// reported where Fila/Biblioteca appeared empty despite the store having data.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    logger.error("Erro ao renderizar a tela. Conteúdo ficaria em branco sem este aviso", {
      message: error.message,
      stack: error.stack,
      componentStack: info?.componentStack,
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback message={this.state.error.message} />;
    }
    return this.props.children;
  }
}
