import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import logger from "./lib/logger.js";
import "./index.css";

window.addEventListener("error", (e) => {
  logger.error("Erro não tratado na interface", { message: e.message, filename: e.filename, lineno: e.lineno });
});
window.addEventListener("unhandledrejection", (e) => {
  logger.error("Promise rejeitada sem tratamento", { reason: e.reason?.stack || String(e.reason) });
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
