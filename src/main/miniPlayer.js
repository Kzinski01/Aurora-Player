const path = require("path");
const { BrowserWindow, screen } = require("electron");
const log = require("./logger");
const { trustWindow } = require("./windowSecurity");

// The card itself is 350x108. The window is bigger by GUTTER on every side so
// the card's CSS drop-shadow has somewhere to fall.
//
// GUTTER must exceed the shadow's furthest reach (offset + blur - spread). A
// shadow larger than the gutter gets clipped at the window bounds, and the cut
// shows up on screen as faint straight dark edges framing the card — which is
// exactly what it looked like before this was tightened.
//
// Keep these in sync with the inline width/height and boxShadow in
// MiniPlayer.jsx: the card is sized in the renderer, this window around it.
const CARD_WIDTH = 350;
const CARD_HEIGHT = 108;
const GUTTER = 10;
const WINDOW_WIDTH = CARD_WIDTH + GUTTER * 2;
const WINDOW_HEIGHT = CARD_HEIGHT + GUTTER * 2;

const SCREEN_MARGIN = 24;
const SAVE_POSITION_DEBOUNCE_MS = 400;
const POSITION_KEY = "miniPlayerPosition";

let miniWindow = null;
let store = null;
let getMainWindow = () => null;
let savePositionTimer = null;
// Mirrors the last state pushed by the main window so a mini player opened
// mid-song paints the current track immediately instead of an empty card
// until the next state push happens to arrive.
let lastState = null;

function init(deps) {
  store = deps.store;
  getMainWindow = deps.getMainWindow;
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WINDOW_WIDTH - SCREEN_MARGIN,
    y: workArea.y + workArea.height - WINDOW_HEIGHT - SCREEN_MARGIN,
  };
}

// A saved position is only reusable if it still lands on a display that exists
// — otherwise unplugging the monitor the mini player was parked on would
// restore it into empty space, invisible and unrecoverable.
function isOnSomeDisplay({ x, y }) {
  return screen.getAllDisplays().some(({ workArea }) => {
    const withinX = x + WINDOW_WIDTH > workArea.x && x < workArea.x + workArea.width;
    const withinY = y + WINDOW_HEIGHT > workArea.y && y < workArea.y + workArea.height;
    return withinX && withinY;
  });
}

function restoredPosition() {
  const saved = store.get(POSITION_KEY);
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return defaultPosition();
  if (!isOnSomeDisplay(saved)) {
    log.info("miniPlayer", "posição salva está fora das telas atuais. Voltando à posição padrão", saved);
    return defaultPosition();
  }
  return { x: Math.round(saved.x), y: Math.round(saved.y) };
}

// "move" fires continuously while dragging; only the position the window is
// left at needs to survive to the next launch.
function schedulePersistPosition() {
  clearTimeout(savePositionTimer);
  savePositionTimer = setTimeout(() => {
    if (!miniWindow || miniWindow.isDestroyed()) return;
    const [x, y] = miniWindow.getPosition();
    store.set(POSITION_KEY, { x, y });
  }, SAVE_POSITION_DEBOUNCE_MS);
}

function create() {
  const { x, y } = restoredPosition();
  miniWindow = new BrowserWindow({
    x,
    y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    // The rounded card draws its own shadow; the native one would square off
    // the corners around it.
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    icon: path.join(__dirname, "..", "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The spectrum animation and progress ticks must keep running while the
      // window sits unfocused behind whatever the user is actually working in.
      backgroundThrottling: false,
    },
  });

  // "normal" is deliberate: it floats above ordinary windows but stays below
  // the exclusive-fullscreen surface a game takes over, which is what avoids
  // the flicker/mode-switch problems higher levels ("screen-saver", "pop-up-menu")
  // cause on Windows.
  miniWindow.setAlwaysOnTop(true, "normal");

  miniWindow.on("move", schedulePersistPosition);
  miniWindow.on("closed", () => {
    miniWindow = null;
  });
  miniWindow.webContents.on("did-fail-load", (_e, code, description, url) => {
    log.error("miniPlayer", "did-fail-load", { code, description, url });
  });
  miniWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  miniWindow.webContents.on("will-navigate", (event) => event.preventDefault());

  trustWindow(miniWindow, path.join(__dirname, "..", "renderer", "dist", "mini.html"), "mini");
  miniWindow.loadFile(path.join(__dirname, "..", "renderer", "dist", "mini.html"));
  return miniWindow;
}

function isVisible() {
  return Boolean(miniWindow && !miniWindow.isDestroyed() && miniWindow.isVisible());
}

function notifyMainWindowVisibility(visible) {
  const main = getMainWindow();
  if (!main || main.isDestroyed()) return;
  // The main window owns playback, so it also owns the analyser feeding the
  // spectrum — telling it when nobody is watching lets it stop the FFT loop
  // instead of burning a frame budget on invisible bars.
  main.webContents.send("mini:visibility", visible);
}

function show() {
  const isFirstShow = !miniWindow || miniWindow.isDestroyed();
  if (isFirstShow) create();

  // showInactive: surfacing the mini player must never steal focus from
  // whatever the user switched to after closing the main window.
  const reveal = () => {
    if (!miniWindow || miniWindow.isDestroyed()) return;
    miniWindow.showInactive();
    if (lastState) miniWindow.webContents.send("mini:state", lastState);
    notifyMainWindowVisibility(true);
  };

  // On a freshly created window, showing before the renderer has painted puts
  // an empty transparent rectangle on screen for a beat — very visible on a
  // frameless card that is supposed to just appear, already drawn.
  if (isFirstShow) miniWindow.once("ready-to-show", reveal);
  else reveal();
}

function hide() {
  if (!miniWindow || miniWindow.isDestroyed()) return;
  miniWindow.hide();
  notifyMainWindowVisibility(false);
}

function destroy() {
  clearTimeout(savePositionTimer);
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.destroy();
  miniWindow = null;
}

function pushState(state) {
  lastState = state;
  if (!isVisible()) return;
  miniWindow.webContents.send("mini:state", state);
}

function pushSpectrum(bars) {
  if (!isVisible()) return;
  miniWindow.webContents.send("mini:spectrum", bars);
}

// Commands travel mini window -> main process -> main window, because the
// audio element, the queue and the library all live in the main window's
// renderer. The mini player is a remote control, never a second player.
function forwardCommand(command) {
  const main = getMainWindow();
  if (!main || main.isDestroyed()) return false;
  main.webContents.send("mini:command", command);
  return true;
}

module.exports = {
  init,
  show,
  hide,
  destroy,
  isVisible,
  pushState,
  pushSpectrum,
  forwardCommand,
};
