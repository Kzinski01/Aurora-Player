const path = require("path");
const { Tray, Menu, nativeImage } = require("electron");
const log = require("./logger");

// The renderer's i18n dictionaries are ES modules bundled by Vite and can't be
// required from the main process, so the handful of strings the tray needs are
// kept here. Anything longer than a menu label belongs in the renderer's
// locales, not in this map.
const LABELS = {
  "pt-BR": { open: "Abrir Aurora", mini: "Mini player", quit: "Sair", tooltip: "Aurora Downloader" },
  en: { open: "Open Aurora", mini: "Mini player", quit: "Quit", tooltip: "Aurora Downloader" },
  es: { open: "Abrir Aurora", mini: "Mini reproductor", quit: "Salir", tooltip: "Aurora Downloader" },
  de: { open: "Aurora öffnen", mini: "Mini-Player", quit: "Beenden", tooltip: "Aurora Downloader" },
  ja: { open: "Aurora を開く", mini: "ミニプレーヤー", quit: "終了", tooltip: "Aurora Downloader" },
  zh: { open: "打开 Aurora", mini: "迷你播放器", quit: "退出", tooltip: "Aurora Downloader" },
  ru: { open: "Открыть Aurora", mini: "Мини-плеер", quit: "Выход", tooltip: "Aurora Downloader" },
};

let tray = null;
let deps = null;

function labels() {
  return LABELS[deps.store.get("language")] || LABELS["pt-BR"];
}

function buildMenu() {
  const l = labels();
  return Menu.buildFromTemplate([
    { label: l.open, click: () => deps.onOpenMain() },
    {
      label: l.mini,
      type: "checkbox",
      checked: deps.isMiniVisible(),
      click: () => deps.onToggleMini(),
    },
    { type: "separator" },
    { label: l.quit, click: () => deps.onQuit() },
  ]);
}

// Rebuilt rather than mutated: the mini-player checkbox and the language both
// change at runtime, and Electron's Menu items are immutable once built.
function refresh() {
  if (!tray || tray.isDestroyed()) return;
  const l = labels();
  tray.setToolTip(l.tooltip);
  tray.setContextMenu(buildMenu());
}

function create(dependencies) {
  deps = dependencies;
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "..", "assets", "icon-256.png"));
  // The full-size icon renders blurry in the notification area — Windows wants
  // roughly 16px there and scales anything larger badly.
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  refresh();

  // Single click is the Windows convention for "give me the app back".
  tray.on("click", () => deps.onOpenMain());
  log.info("tray", "ícone da bandeja criado");
  return tray;
}

function destroy() {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
}

module.exports = { create, refresh, destroy };
