const path = require("path");
const { fileURLToPath } = require("url");

const windows = new Map();

function isExpectedDocument(url, file) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "file:" && path.resolve(fileURLToPath(parsed)) === path.resolve(file);
  } catch {
    return false;
  }
}

function trustWindow(window, documentPath, role) {
  windows.set(window.webContents, { documentPath, role });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.once("closed", () => windows.delete(window.webContents));
}

function isTrustedSender(event, roles = ["main"]) {
  const trusted = windows.get(event.sender);
  return Boolean(trusted && roles.includes(trusted.role) &&
    event.senderFrame === event.sender.mainFrame &&
    isExpectedDocument(event.senderFrame?.url, trusted.documentPath));
}

function assertTrustedSender(event, roles) {
  if (!isTrustedSender(event, roles)) throw new Error("Esta janela não pode executar essa ação.");
}

module.exports = { trustWindow, isTrustedSender, assertTrustedSender, isExpectedDocument };
