import fs from "node:fs";
import { Session, waitForTarget, waitFor, sleep } from "./lib/cdp.mjs";
import { createReporter } from "./lib/harness.mjs";

export default async function run() {
  const { check, summary } = createReporter("Frontend redesenhado");
  const session = await Session.open(await waitForTarget(t => t.type === "page" && t.url.includes("index.html")));
  const evaluate = expression => session.evaluate(expression);
  const originalSidebar = await evaluate(`localStorage.getItem('aurora.sidebar.collapsed')`);
  const key = async (key, code = key, modifiers = 0) => {
    const windowsVirtualKeyCode = { Enter: 13, Tab: 9, Escape: 27, Home: 36, End: 35, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39 }[key];
    await session.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, windowsVirtualKeyCode });
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers, windowsVirtualKeyCode });
  };
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await sleep(120); };
  const navigate = label => click(`aside button[aria-label="${label}"]`);
  const field = async (selector, value) => {
    await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles:true })); })()`);
    await sleep(100);
  };
  const shot = async name => {
    fs.mkdirSync("output/playwright", { recursive: true });
    const result = await session.send("Page.captureScreenshot");
    fs.writeFileSync(`output/playwright/${name}.png`, Buffer.from(result.data, "base64"));
  };
  try {
    await evaluate(`window.aurora.setSettings({ language:'en', theme:'dark' })`);
    await evaluate(`localStorage.setItem('aurora.sidebar.collapsed','false')`);
    await session.send("Page.reload");
    await waitFor(session, `!!document.querySelector('#media-links')`, Boolean);
    check("nuvem inicia em repouso", await evaluate(`!!document.querySelector('.analyze-button .pixel-cloud--idle')`));
    await field("#media-links", "file:///C:/private.mp4");
    await click(".analyze-button");
    check("entrada inválida exibe erro associado e nuvem de erro", await evaluate(`document.querySelector('#media-links').getAttribute('aria-invalid') === 'true' && !!document.querySelector('#analysis-feedback') && !!document.querySelector('.analyze-button .pixel-cloud--error')`));
    await shot("after-analysis-error");
    await click('button[aria-label="Clear"]');
    check("limpar devolve foco à entrada", await evaluate(`document.activeElement.id === 'media-links' && document.activeElement.value === ''`));

    await click(".collapse-navigation");
    await sleep(300);
    check("sidebar recolhe e mantém nomes acessíveis", await evaluate(`document.querySelector('.sidebar').getBoundingClientRect().width === 76 && document.querySelector('aside button[aria-label="Library"]') !== null`));
    check("preferência da sidebar persiste", await evaluate(`localStorage.getItem('aurora.sidebar.collapsed') === 'true'`));
    await click(".collapse-navigation");

    await navigate("Settings");
    await click('button[aria-label="Theme"]');
    await key("Home");
    await key("ArrowDown");
    await key("Enter");
    await waitFor(session, `document.documentElement.dataset.theme`, v => v === "light");
    check("dropdown de tema funciona pelo teclado", (await evaluate(`window.aurora.getSettings()`)).theme === "light");
    check("dropdown devolve foco ao controle", await evaluate(`document.activeElement.getAttribute('aria-label') === 'Theme'`));
    await click('button[aria-label="Theme"]');
    await key("Home"); await key("Enter");
    await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
    await waitFor(session, `document.documentElement.dataset.theme`, v => v === "dark");
    await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
    await waitFor(session, `document.documentElement.dataset.theme`, v => v === "light");
    check("tema Sistema reage à alteração do sistema", (await evaluate(`window.aurora.getSettings()`)).theme === "system");

    await navigate("Profile");
    await waitFor(session, `!!document.querySelector('input[type="color"]')`, Boolean);
    for (const [hex, expected] of [["#ffffff", "16 18 25"], ["#000000", "255 255 255"]]) {
      await field('input[type="color"]', hex);
      await waitFor(session, `document.documentElement.style.getPropertyValue('--on-accent')`, v => v === expected);
      check(`texto sobre destaque ${hex} tem contraste adaptado`, true);
    }
    await click('button[aria-label="#7C6CFF"]');

    await navigate("Library");
    await waitFor(session, `!!document.querySelector('button[title*="Rename"]')`, Boolean);
    await evaluate(`document.querySelector('button[title*="Rename"]').focus()`);
    await click('button[title*="Rename"]');
    await waitFor(session, `!!document.querySelector('[role="dialog"]')`, Boolean);
    check("diálogo tem nome acessível e recebe foco", await evaluate(`!!document.querySelector('[role="dialog"]').getAttribute('aria-labelledby') && document.querySelector('[role="dialog"]').contains(document.activeElement)`));
    await evaluate(`[...document.querySelector('[role="dialog"]').querySelectorAll('button')].at(-1).focus()`);
    await key("Tab");
    check("Tab permanece no diálogo", await evaluate(`document.querySelector('[role="dialog"]').contains(document.activeElement)`));
    await shot("after-playlist-modal");
    await key("Escape");
    await sleep(250);
    check("Escape fecha diálogo e restaura foco", await evaluate(`!document.querySelector('[role="dialog"]') && document.activeElement.title.includes('Rename')`));

    await click('button[title*="Trim"]');
    await waitFor(session, `Number(document.querySelector('[role="slider"][aria-label="Trim end"]')?.getAttribute('aria-valuemax'))`, v => v > 0);
    const before = await evaluate(`Number(document.querySelector('[aria-label="Trim start"]').getAttribute('aria-valuenow'))`);
    await evaluate(`document.querySelector('[aria-label="Trim start"]').focus()`);
    await key("ArrowRight");
    check("início do corte pode ser ajustado pelo teclado", await evaluate(`Number(document.querySelector('[aria-label="Trim start"]').getAttribute('aria-valuenow')) > ${before}`));
    await shot("after-editor-light");
    await session.send("Emulation.setDeviceMetricsOverride", { width: 960, height: 640, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    check("editor cabe na janela mínima", await evaluate(`document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth`));
    await shot("after-editor-minimum");
    await session.send("Emulation.clearDeviceMetricsOverride");
    await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    check("preferência de movimento reduzido ativa", await evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`));
  } finally {
    await session.send("Emulation.clearDeviceMetricsOverride");
    await session.send("Emulation.setEmulatedMedia", { features: [] });
    await evaluate(originalSidebar === null ? `localStorage.removeItem('aurora.sidebar.collapsed')` : `localStorage.setItem('aurora.sidebar.collapsed',${JSON.stringify(originalSidebar)})`);
    session.close();
  }
  return summary();
}
