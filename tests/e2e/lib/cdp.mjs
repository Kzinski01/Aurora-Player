// Minimal Chrome DevTools Protocol client, shared by every suite.
//
// The app is driven as a user would drive it — real pointer events, real window
// messages — because the bugs worth catching here live in the seams between the
// main process, the two renderers and Windows itself, and none of those seams
// exist in a unit test.
import { execFileSync } from "child_process";

export const CDP_PORT = process.env.AURORA_CDP_PORT || "9333";
const CDP = `http://127.0.0.1:${CDP_PORT}`;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listTargets() {
  const response = await fetch(`${CDP}/json`);
  return response.json();
}

export async function waitForTarget(predicate, { timeout = 20000, label = "alvo" } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = (await listTargets()).find(predicate);
    if (found) return found;
    await sleep(300);
  }
  throw new Error(`timeout esperando ${label}`);
}

export class Session {
  constructor(socket) {
    this.socket = socket;
    this.lastId = 0;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const resolve = this.pending.get(message.id);
      if (!resolve) return;
      this.pending.delete(message.id);
      resolve(message);
    });
  }

  static async open(target) {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const session = new Session(socket);
    await session.send("Runtime.enable");
    return session;
  }

  send(method, params = {}) {
    const id = ++this.lastId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (message) =>
        message.error ? reject(new Error(message.error.message)) : resolve(message.result)
      );
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  // Surfaces page-side exceptions as real errors rather than quietly resolving
  // to undefined, which is how a broken selector otherwise reads as a pass.
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || "erro na avaliação");
    }
    return result.result.value;
  }

  close() {
    this.socket.close();
  }
}

export async function waitFor(session, expression, predicate, { timeout = 15000, label = "condição" } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await session.evaluate(expression);
    if (predicate(last)) return last;
    await sleep(200);
  }
  throw new Error(`timeout em ${label} (último valor: ${JSON.stringify(last)})`);
}

// Real mouse events rather than element.click(): the mini player's controls sit
// inside a -webkit-app-region drag surface, and only genuine pointer input
// exercises that path.
export async function clickAt(session, x, y, { clickCount = 1 } = {}) {
  const base = { x, y, button: "left", clickCount, buttons: 1 };
  await session.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
  await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base, buttons: 0 });
}

export async function centerOf(session, selector) {
  const box = await session.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`elemento não encontrado: ${selector}`);
  return box;
}

function powershell(script) {
  return execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
}

const WINDOW_HELPER = `
$sig = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class AuroraWin {
  public delegate bool Proc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Proc p, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
Add-Type -TypeDefinition $sig
`;

// Ground truth for "is this window on screen". Electron leaves a hidden
// window's document.visibilityState at "visible" when background throttling is
// disabled, so the renderer cannot answer this about itself.
export function nativeWindows() {
  const raw = powershell(`${WINDOW_HELPER}
$acc = New-Object System.Collections.ArrayList
$cb = [AuroraWin+Proc]{ param($h, $l)
  $sb = New-Object System.Text.StringBuilder 256
  [AuroraWin]::GetWindowText($h, $sb, 256) | Out-Null
  $t = $sb.ToString()
  if ($t -like "Aurora*") {
    $r = New-Object AuroraWin+RECT
    [AuroraWin]::GetWindowRect($h, [ref]$r) | Out-Null
    $null = $acc.Add([pscustomobject]@{ title = $t; visible = [AuroraWin]::IsWindowVisible($h); w = $r.Right - $r.Left; h = $r.Bottom - $r.Top; x = $r.Left; y = $r.Top })
  }
  return $true
}
[AuroraWin]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
# Windows PowerShell 5.1 has no -AsArray, and a single object would serialise
# as an object rather than a one-element array.
"[" + (($acc | ForEach-Object { $_ | ConvertTo-Json -Compress }) -join ",") + "]"
`);
  return raw ? JSON.parse(raw) : [];
}

// Closes the main window the way a user does. The renderer's window.close() is
// not equivalent: it tears the window down without going through the
// BrowserWindow 'close' handler, skipping the hide-to-tray behaviour entirely.
export function closeMainWindowNatively() {
  return powershell(`${WINDOW_HELPER}
$p = Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq 'Aurora' } | Select-Object -First 1
if ($p) { [AuroraWin]::SendMessage($p.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null; 'sent' } else { 'no-window' }
`);
}

export async function waitForNativeWindow(predicate, { timeout = 15000, label = "janela" } = {}) {
  const deadline = Date.now() + timeout;
  let last = [];
  while (Date.now() < deadline) {
    last = nativeWindows();
    const found = last.find(predicate);
    if (found) return found;
    await sleep(400);
  }
  throw new Error(`timeout esperando ${label} (janelas: ${JSON.stringify(last)})`);
}
