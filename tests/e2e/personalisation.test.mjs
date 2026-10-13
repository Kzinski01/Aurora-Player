// Accent colour and playlist rename — the two features that used to exist only
// as data the app stored and ignored.
import fs from "fs";
import path from "path";
import { Session, waitForTarget, waitFor, sleep } from "./lib/cdp.mjs";
import { createReporter, PROFILE_FILE, PLAYLISTS_DIR } from "./lib/harness.mjs";

const DEFAULT_ACCENT = "#7C6CFF";
const DEFAULT_ACCENT_RGB = "124 108 255";
const TEST_ACCENT = "#2FBFA0";
const TEST_ACCENT_RGB = "47 191 160";

const accentVariable = `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`;
const goToPage = (pattern) =>
  `[...document.querySelectorAll('nav button')].find((b) => ${pattern}.test(b.innerText)).click()`;

export default async function run() {
  const { check, summary } = createReporter("Personalização");

  const target = await waitForTarget((t) => t.type === "page" && t.url.includes("index.html"), {
    label: "janela principal",
  });
  const session = await Session.open(target);
  await waitFor(session, "document.querySelectorAll('nav button').length", (n) => n >= 5, { label: "interface pronta" });

  // ------------------------------------------------------------- cor de destaque
  await session.evaluate(goToPage("/Perfil|Profile|Профиль|个人资料|プロフィール/i"));
  await sleep(1400);

  const swatches = await session.evaluate(`document.querySelectorAll('button[aria-label^="#"]').length`);
  check("seletor de cores presente no Perfil", swatches >= 8, `${swatches} amostras`);

  await session.evaluate(`document.querySelector('button[aria-label="${TEST_ACCENT}"]').click()`);
  const applied = await waitFor(session, accentVariable, (v) => v === TEST_ACCENT_RGB, { label: "accent aplicado" })
    .then(() => true)
    .catch(() => false);
  check("escolher a cor repinta a variável --accent", applied, TEST_ACCENT_RGB);

  const companions = await session.evaluate(`(() => {
    const style = getComputedStyle(document.documentElement);
    const sum = (name) => style.getPropertyValue(name).trim().split(' ').map(Number).reduce((a, b) => a + b, 0);
    return { base: sum('--accent'), soft: sum('--accent-soft'), deep: sum('--accent-deep') };
  })()`);
  check("variante clara é mais clara", companions.soft > companions.base);
  check("variante escura é mais escura", companions.deep < companions.base);

  check(
    "cor gravada no profile.json",
    JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8")).accentColor === TEST_ACCENT
  );

  // The real proof is paint, not a variable: check elements that opted into the
  // accent through Tailwind classes, on a page without the colour picker.
  await session.evaluate(goToPage("/Biblioteca|Library|Bibliothek|媒体库|ライブラリ|Библиотека/i"));
  await sleep(1400);
  const painted = await session.evaluate(`(() => {
    const els = [...document.querySelectorAll('.nav-item.is-active, .playlist-chip.is-active, [class*="accent"]')].slice(0, 20);
    const dump = els.map((el) => {
      const cs = getComputedStyle(el);
      return cs.backgroundImage + '|' + cs.backgroundColor + '|' + cs.color + '|' + cs.boxShadow;
    }).join(' ');
    return { hasNew: dump.includes('47, 191, 160'), hasOld: dump.includes('124, 108, 255'), count: els.length };
  })()`);
  check("elementos reais repintados com a nova cor", painted.hasNew, `${painted.count} elementos accent`);
  check("nenhum resquício da cor padrão", !painted.hasOld);

  await session.evaluate(goToPage("/Perfil|Profile|Профиль|个人资料|プロフィール/i"));
  await sleep(1200);
  await session.evaluate(`document.querySelector('button[aria-label="${DEFAULT_ACCENT}"]').click()`);
  await waitFor(session, accentVariable, (v) => v === DEFAULT_ACCENT_RGB, { label: "padrão restaurado" });
  // Choosing the default clears the inline variables so index.css takes over,
  // which is what keeps the original hand-tuned palette exact.
  check(
    "voltar ao padrão limpa a variável inline",
    (await session.evaluate(`document.documentElement.style.getPropertyValue('--accent') === ''`)) === true
  );

  // ------------------------------------------------------------- renomear playlist
  await session.evaluate(goToPage("/Biblioteca|Library|Bibliothek|媒体库|ライブラリ|Библиотека/i"));
  await sleep(1400);

  const renameButtons = await session.evaluate(
    `document.querySelectorAll('button[title*="Renomear"], button[title*="Rename"], button[title*="Renombrar"], button[title*="umbenennen"], button[title*="重命名"], button[title*="名を変更"], button[title*="Переименовать"]').length`
  );
  if (renameButtons === 0) {
    check("existe alguma playlist para renomear", false, "nenhuma playlist na biblioteca");
    session.close();
    return summary();
  }
  check("botão de renomear aparece nos chips", true, `${renameButtons} playlist(s)`);

  const originalName = await session.evaluate(`(() => {
    const btn = document.querySelector('button[title*="Renomear"], button[title*="Rename"], button[title*="Renombrar"], button[title*="umbenennen"], button[title*="重命名"], button[title*="名を変更"], button[title*="Переименовать"]');
    return btn.parentElement.querySelector('button').innerText.trim();
  })()`);

  await session.evaluate(
    `document.querySelector('button[title*="Renomear"], button[title*="Rename"], button[title*="Renombrar"], button[title*="umbenennen"], button[title*="重命名"], button[title*="名を変更"], button[title*="Переименовать"]').click()`
  );
  await waitFor(session, `!!document.querySelector('input[maxlength="60"]')`, (v) => v === true, { label: "modal de rename" });
  check("modal de renomear abre", true);

  const newName = `E2E ${Date.now() % 100000}`;
  await session.evaluate(`(() => {
    const input = document.querySelector('input[maxlength="60"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(newName)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await session.evaluate(
    `[...document.querySelectorAll('button')].find((b) => /Salvar|Save|Guardar|Speichern|保存|Сохранить/.test(b.innerText)).click()`
  );

  const shown = await waitFor(session, `document.body.innerText.includes(${JSON.stringify(newName)})`, (v) => v === true, {
    label: "nome novo na interface",
  }).then(() => true).catch(() => false);
  check("nome novo aparece na interface", shown, `${originalName} -> ${newName}`);

  await sleep(900);
  const namesOnDisk = fs
    .readdirSync(PLAYLISTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(PLAYLISTS_DIR, file), "utf8")).name;
      } catch {
        return null;
      }
    });
  check("nome novo gravado no arquivo da playlist", namesOnDisk.includes(newName), namesOnDisk.join(", "));

  session.close();
  return summary();
}
