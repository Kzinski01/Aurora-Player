import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { CDP_PORT, sleep } from "./cdp.mjs";

const projectRoot = path.resolve(import.meta.dirname, "../../..");
const testDirectory = path.join(projectRoot, "output");
fs.mkdirSync(testDirectory, { recursive: true });
export const USER_DATA = fs.mkdtempSync(path.join(testDirectory, "aurora-e2e-"));
export const LIBRARY_FILE = path.join(USER_DATA, "Biblioteca/library.json");
export const CONFIG_FILE = path.join(USER_DATA, "config.json");
export const PROFILE_FILE = path.join(USER_DATA, "Profile/profile.json");
export const PLAYLISTS_DIR = path.join(USER_DATA, "Playlists");
let appProcess = null;

export function backupUserData() {
  const downloads = path.join(USER_DATA, "Downloads");
  for (const directory of [downloads, path.dirname(LIBRARY_FILE), path.dirname(PROFILE_FILE), PLAYLISTS_DIR]) fs.mkdirSync(directory, { recursive: true });
  const ffmpeg = path.join(projectRoot, "resources/bin/ffmpeg.exe");
  const audio = path.join(downloads, "audio-test.mp3");
  const video = path.join(downloads, "video-test.mp4");
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "anoisesrc=color=white:amplitude=0.3:duration=120", "-c:a", "libmp3lame", audio], { windowsHide: true });
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=24", "-f", "lavfi", "-i", "sine=frequency=880:duration=24", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", video], { windowsHide: true });
  const library = [
    { id: "test-audio", title: "Áudio de teste", thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='blue'/%3E%3C/svg%3E", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", mode: "audio", format: "mp3", filePath: audio, favorite: false },
    { id: "test-video", title: "Vídeo de teste", thumbnail: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='blue'/%3E%3C/svg%3E", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", mode: "video", format: "mp4", resolution: "180", filePath: video, favorite: false },
  ];
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify({ library }));
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ downloadDir: downloads, language: "pt-BR", theme: "dark", discordRichPresence: false, maxConcurrent: 3, volume: 0.5 }));
  fs.writeFileSync(path.join(PLAYLISTS_DIR, "test.json"), JSON.stringify({ id: "test", name: "Playlist de teste", tracks: [{ id: 1, music_ID: "test-audio" }, { id: 2, music_ID: "test-video" }] }));
}

export function restoreUserData() {
  if (path.dirname(USER_DATA) !== testDirectory || !path.basename(USER_DATA).startsWith("aurora-e2e-")) throw new Error("Pasta de testes inválida.");
  try {
    fs.rmSync(USER_DATA, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    return true;
  } catch (error) {
    if (!["EPERM", "EBUSY"].includes(error.code)) throw error;
    console.warn(`O Windows manteve os arquivos de teste em ${USER_DATA}: ${error.code}`);
    return false;
  }
}

export async function launchApp() {
  const env = { ...process.env, AURORA_E2E_USER_DATA: USER_DATA };
  delete env.ELECTRON_RUN_AS_NODE;
  const { default: electronPath } = await import("electron");
  appProcess = spawn(electronPath, [projectRoot, `--remote-debugging-port=${CDP_PORT}`, "--remote-debugging-address=127.0.0.1"], { cwd: projectRoot, env, stdio: "ignore", windowsHide: true });
  await sleep(24000);
}

export function stopApp() {
  if (!appProcess?.pid) return;
  try { execFileSync(path.join(process.env.SystemRoot, "System32/taskkill.exe"), ["/pid", String(appProcess.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }); }
  catch { appProcess.kill(); }
  appProcess = null;
}

export function pickLibraryFiles() {
  const library = JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf8")).library;
  const playable = library.filter((item) => !item.removed && item.filePath && fs.existsSync(item.filePath));
  return { video: playable.find((item) => item.mode === "video") ?? null, audio: playable.find((item) => item.mode === "audio") ?? null, count: playable.length };
}

export function appLanguage() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")).language || "pt-BR"; }
  catch { return "pt-BR"; }
}

export function createReporter(suiteName) {
  const results = [];
  return {
    check(name, passed, detail = "") {
      results.push({ name, passed: Boolean(passed), detail });
      console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
      return Boolean(passed);
    },
    summary() { return { suiteName, total: results.length, failed: results.filter((result) => !result.passed) }; },
  };
}
