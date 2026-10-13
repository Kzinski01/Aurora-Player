// Background mini player: closing to tray, the card's geometry, the canvas
// spectrum, and the command round-trip back to the hidden main window.
import fs from "fs";
import {
  Session, waitForTarget, waitFor, clickAt, centerOf, sleep,
  nativeWindows, waitForNativeWindow, closeMainWindowNatively,
} from "./lib/cdp.mjs";
import { createReporter, appLanguage, LIBRARY_FILE } from "./lib/harness.mjs";

// Button titles come from the app's own locale, so the suite reads the
// configured language rather than assuming pt-BR.
const LABELS = {
  "pt-BR": { nothing: "Nada tocando", play: "Reproduzir", pause: "Pausar", next: "Próxima", shuffle: "Aleatório", favorite: "Favoritar", hide: "Ocultar o mini player" },
  en: { nothing: "Nothing playing", play: "Play", pause: "Pause", next: "Next", shuffle: "Shuffle", favorite: "Favorite", hide: "Hide the mini player" },
  es: { nothing: "Nada en reproducción", play: "Reproducir", pause: "Pausar", next: "Siguiente", shuffle: "Aleatorio", favorite: "Favorito", hide: "Ocultar el mini reproductor" },
  de: { nothing: "Nichts wird abgespielt", play: "Abspielen", pause: "Pause", next: "Weiter", shuffle: "Zufallswiedergabe", favorite: "Favorit", hide: "Mini-Player ausblenden" },
};

const CARD = { width: 350, height: 108 };
const WINDOW = { width: 370, height: 128 };

export default async function run() {
  const { check, summary } = createReporter("Mini player");
  const language = appLanguage();
  const labels = LABELS[language] ?? LABELS["pt-BR"];

  const mainTarget = await waitForTarget((t) => t.type === "page" && t.url.includes("index.html"), {
    label: "janela principal",
  });
  const mainSession = await Session.open(mainTarget);
  await waitFor(mainSession, "document.querySelectorAll('nav button').length", (n) => n >= 5, {
    label: "interface pronta",
  });

  // ------------------------------------------------------------- sem música
  const closeResult = closeMainWindowNatively();
  const alreadyHidden =
    closeResult === "no-window" && nativeWindows().some((w) => w.title === "Aurora" && !w.visible);
  check("fechar a janela principal (WM_CLOSE)", closeResult === "sent" || alreadyHidden, closeResult);

  const miniTarget = await waitForTarget((t) => t.type === "page" && t.url.includes("mini.html"), {
    label: "janela do mini player",
  });
  const miniSession = await Session.open(miniTarget);
  await sleep(1200);

  const windows = nativeWindows();
  const mainNative = windows.find((w) => w.title === "Aurora");
  const miniNative = windows.find((w) => w.title.includes("Mini player"));
  check("janela principal ocultada, não encerrada", mainNative && !mainNative.visible);
  check("mini player visível", miniNative?.visible === true, `${miniNative?.w}x${miniNative?.h}`);
  check("renderer principal segue vivo", (await mainSession.evaluate("typeof window.aurora")) === "object");

  const emptyText = await miniSession.evaluate("document.body.innerText");
  check(`estado vazio (idioma: ${language})`, emptyText.includes(labels.nothing));

  const geometry = await miniSession.evaluate(`(() => {
    const card = document.querySelector('[style*="app-region: drag"]');
    const rect = card.getBoundingClientRect();
    const shadow = getComputedStyle(card.parentElement).boxShadow;
    // parseFloat, not Number: the matches carry their "px" unit, and Number("2px")
    // is NaN — which JSON-serialises to null and then compares as 0, making this
    // assertion pass without ever testing anything.
    const numbers = (shadow.match(/-?\\d+(\\.\\d+)?px/g) || []).map(parseFloat);
    const [offsetX = 0, offsetY = 0, blur = 0, spread = 0] = numbers;
    return {
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      viewportW: innerWidth,
      viewportH: innerHeight,
      shadowReach: Math.max(Math.abs(offsetX), Math.abs(offsetY)) + blur - spread,
      gutter: (innerWidth - rect.width) / 2,
      spills: [...card.querySelectorAll('button, span, div')].filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        return r.bottom > rect.bottom + 0.5 || r.top < rect.top - 0.5 || r.right > rect.right + 0.5 || r.left < rect.left - 0.5;
      }).length,
    };
  })()`);
  check("card no tamanho definido", geometry.w === CARD.width && geometry.h === CARD.height, `${geometry.w}x${geometry.h}`);
  check("janela = card + calha", geometry.viewportW === WINDOW.width && geometry.viewportH === WINDOW.height);
  // A shadow larger than the gutter gets clipped at the window bounds, and the
  // cut reads on screen as dark borders framing the card.
  check(
    "sombra cabe na calha",
    Number.isFinite(geometry.shadowReach) && geometry.shadowReach <= geometry.gutter,
    `${geometry.shadowReach}px de alcance vs ${geometry.gutter}px de calha`
  );
  check("nada estoura o card", geometry.spills === 0);

  const canvas = await miniSession.evaluate(`(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const card = document.querySelector('[style*="app-region: drag"]').getBoundingClientRect();
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for (let i = 3; i < img.length; i += 4) if (img[i] > 8) ink++;
    return {
      height: Math.round(r.height),
      fullWidth: Math.abs(r.width - card.width) < 1,
      flushBottom: Math.abs(r.bottom - card.bottom) < 1,
      backingMatchesDpr: c.width === Math.round(r.width * devicePixelRatio),
      ink,
    };
  })()`);
  check("espectro tem 24px de altura", canvas.height === 24);
  check("espectro ocupa a largura toda e encosta na base", canvas.fullWidth && canvas.flushBottom);
  check("canvas escalado por devicePixelRatio", canvas.backingMatchesDpr === true);
  check("sem faixa o espectro some", canvas.ink === 0, `${canvas.ink} pixels`);

  const controls = await miniSession.evaluate(
    `[...document.querySelectorAll('button')].map((b) => b.getAttribute('title'))`
  );
  const missing = [labels.shuffle, labels.play, labels.next, labels.favorite].filter((l) => !controls.includes(l));
  check("todos os controles presentes", missing.length === 0, missing.join(", "));
  check(
    "controles fora da região de arraste",
    (await miniSession.evaluate(
      `[...document.querySelectorAll('button')].every((b) => getComputedStyle(b).webkitAppRegion === 'no-drag')`
    )) === true
  );

  const card = await centerOf(miniSession, '[style*="app-region: drag"]');
  await clickAt(miniSession, card.x, card.y, { clickCount: 2 });
  const restored = await waitForNativeWindow((w) => w.title === "Aurora" && w.visible, { label: "principal restaurada" })
    .then(() => true)
    .catch(() => false);
  check("clique duplo restaura a janela principal", restored);

  // ------------------------------------------------------------- com música
  await mainSession.evaluate(
    `[...document.querySelectorAll('nav button')].find((b) => /Biblioteca|Library|Bibliothek|媒体库|ライブラリ|Библиотека/i.test(b.innerText)).click()`
  );
  await sleep(1500);
  const started = await mainSession.evaluate(`(() => {
    const buttons = [...document.querySelectorAll('button')].filter(
      (b) => b.classList.contains('library-play') && !b.disabled
    );
    if (!buttons.length) return false;
    buttons[0].click();
    return true;
  })()`);
  check("faixa iniciada a partir da biblioteca", started === true);
  await sleep(2500);

  closeMainWindowNatively();
  await waitForNativeWindow((w) => w.title.includes("Mini player") && w.visible, { label: "mini visível" });
  await sleep(1200);

  const playing = await miniSession.evaluate(`(() => ({
    title: document.querySelector('.font-semibold')?.innerText ?? '',
    thumb: !!document.querySelector('img'),
    paused: !!document.querySelector('button[title=${JSON.stringify(labels.play)}]'),
  }))()`);
  check("mini mostra a faixa em reprodução", playing.title.length > 0 && playing.thumb, playing.title);
  check("estado de reprodução refletido", playing.paused === false);

  const firstTime = await miniSession.evaluate(`document.querySelectorAll('.tabular-nums')[0].innerText`);
  await sleep(3000);
  const laterTime = await miniSession.evaluate(`document.querySelectorAll('.tabular-nums')[0].innerText`);
  check("progresso avança em tempo real", firstTime !== laterTime, `${firstTime} -> ${laterTime}`);

  const drawnBars = await miniSession.evaluate(`(() => {
    const c = document.querySelector('canvas');
    const img = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let runs = 0, inRun = false;
    for (let x = 0; x < c.width; x++) {
      let painted = false;
      for (let y = 0; y < c.height; y++) {
        if (img[(y * c.width + x) * 4 + 3] > 90) { painted = true; break; }
      }
      if (painted && !inRun) runs++;
      inRun = painted;
    }
    return runs;
  })()`);
  check("desenha entre 64 e 80 barras", drawnBars >= 64 && drawnBars <= 80, `${drawnBars} barras`);

  const spectrum = await miniSession.evaluate(`(async () => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    const heights = () => {
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      const out = [];
      for (let x = 0; x < c.width; x += 4) {
        let top = c.height;
        for (let y = 0; y < c.height; y++) {
          if (img[(y * c.width + x) * 4 + 3] > 8) { top = y; break; }
        }
        out.push((c.height - top) / c.height);
      }
      return out;
    };
    const frames = [];
    for (let i = 0; i < 10; i++) { frames.push(heights()); await new Promise((r) => setTimeout(r, 250)); }
    const columns = frames[0].length;
    return {
      peak: Math.max(...frames.flat()),
      rightHalfPeak: Math.max(...frames.map((f) => Math.max(...f.slice(Math.floor(columns / 2))))),
      changed: frames.slice(1).filter((f, i) => f.some((v, j) => Math.abs(v - frames[i][j]) > 0.02)).length,
    };
  })()`);
  check("espectro reage ao áudio", spectrum.changed >= 5, `${spectrum.changed}/9 frames mudaram`);
  check("espectro sai do repouso", spectrum.peak > 0.15, `pico ${(spectrum.peak * 100).toFixed(0)}%`);
  // The previous DOM visualiser only ever animated its left third.
  check("médios e agudos também se movem", spectrum.rightHalfPeak > 0.12, `${(spectrum.rightHalfPeak * 100).toFixed(0)}%`);

  // Command round-trip: mini -> main process -> hidden main window -> back.
  const pauseButton = await centerOf(miniSession, `button[title="${labels.pause}"]`);
  await clickAt(miniSession, pauseButton.x, pauseButton.y);
  const paused = await waitFor(
    miniSession,
    `!!document.querySelector('button[title=${JSON.stringify(labels.play)}]')`,
    (v) => v === true,
    { label: "pausa refletida" }
  ).then(() => true).catch(() => false);
  check("pausar pelo mini controla o player oculto", paused);

  const playButton = await centerOf(miniSession, `button[title="${labels.play}"]`);
  await clickAt(miniSession, playButton.x, playButton.y);
  await waitFor(miniSession, `!!document.querySelector('button[title=${JSON.stringify(labels.pause)}]')`, (v) => v === true, {
    label: "retomada",
  });
  check("retomar pelo mini volta a tocar", true);

  const beforeSeek = await miniSession.evaluate(`document.querySelectorAll('.tabular-nums')[0].innerText`);
  const track = await miniSession.evaluate(`(() => {
    const el = document.querySelector('[class*="bg-gradient-to-r"]').closest('.group');
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })()`);
  await clickAt(miniSession, track.left + track.width * 0.7, track.top + track.height / 2);
  await sleep(1200);
  const afterSeek = await miniSession.evaluate(`document.querySelectorAll('.tabular-nums')[0].innerText`);
  const toSeconds = (text) => text.split(":").map(Number).reduce((acc, part) => acc * 60 + part, 0);
  check("clicar na barra muda a posição", toSeconds(afterSeek) > toSeconds(beforeSeek) + 5, `${beforeSeek} -> ${afterSeek}`);

  const favouriteButton = await centerOf(miniSession, `button[title="${labels.favorite}"]`);
  await clickAt(miniSession, favouriteButton.x, favouriteButton.y);
  await sleep(1500);
  const favourites = JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf8")).library.filter((i) => i.favorite);
  check("favoritar grava na biblioteca em disco", favourites.length > 0, `${favourites.length} favorito(s)`);

  const hideButton = await centerOf(miniSession, `button[title="${labels.hide}"]`);
  await clickAt(miniSession, hideButton.x, hideButton.y);
  const hidden = await waitForNativeWindow((w) => w.title.includes("Mini player") && !w.visible, { label: "mini oculto" })
    .then(() => true)
    .catch(() => false);
  check("botão X apenas oculta o mini player", hidden);
  check("app continua rodando", (await mainSession.evaluate("typeof window.aurora")) === "object");

  mainSession.close();
  miniSession.close();
  return summary();
}
