const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("splash", {
  introEnded: () => ipcRenderer.send("splash:intro-ended"),
});
