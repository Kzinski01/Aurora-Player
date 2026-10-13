import React from "react";
import { MotionConfig } from "framer-motion";
import ReactDOM from "react-dom/client";
import MiniPlayer from "./components/mini/MiniPlayer.jsx";
import logger from "./lib/logger.js";
import "./index.css";

window.addEventListener("error", (e) => {
  logger.error("Erro não tratado no mini player", { message: e.message, filename: e.filename, lineno: e.lineno });
});
window.addEventListener("unhandledrejection", (e) => {
  logger.error("Promise rejeitada sem tratamento no mini player", { reason: e.reason?.stack || String(e.reason) });
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user"><MiniPlayer /></MotionConfig>
  </React.StrictMode>
);
