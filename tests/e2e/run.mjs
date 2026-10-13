// End-to-end runner: boots the real app once, runs every suite against it, and
// puts the user's data back exactly as it was.
//
// Usage:  npm run test:e2e            (all suites)
//         npm run test:e2e -- editor  (only suites whose name contains "editor")
//
// These are integration tests by necessity. What they cover — a hidden window
// still owning playback, a frameless card's geometry, ffmpeg producing a file
// that actually plays — only exists when the whole app is running.
import { backupUserData, restoreUserData, launchApp, stopApp } from "./lib/harness.mjs";
import { CDP_PORT } from "./lib/cdp.mjs";

import editorSuite from "./editor.test.mjs";
import miniPlayerSuite from "./mini-player.test.mjs";
import personalisationSuite from "./personalisation.test.mjs";
import redesignSuite from "./redesign.test.mjs";
import securitySuite from "./security.test.mjs";

const SUITES = [
  { name: "security", run: securitySuite },
  { name: "redesign", run: redesignSuite },
  { name: "editor", run: editorSuite },
  { name: "personalisation", run: personalisationSuite },
  // Last on purpose: it leaves the app with the main window hidden and a track
  // playing, which is the least convenient state for anything after it.
  { name: "mini-player", run: miniPlayerSuite },
];

const filter = process.argv[2];
const selected = filter ? SUITES.filter((s) => s.name.includes(filter)) : SUITES;

if (selected.length === 0) {
  console.error(`Nenhuma suíte corresponde a "${filter}". Disponíveis: ${SUITES.map((s) => s.name).join(", ")}`);
  process.exit(1);
}

async function main() {
  console.log(`Aurora — testes end-to-end (porta CDP ${CDP_PORT})\n`);
  backupUserData();
  console.log("Testes usam dados e mídia temporários.\n");

  const summaries = [];
  try {
    await launchApp();
    for (const suite of selected) {
      console.log(`\n── ${suite.name} ${"─".repeat(Math.max(0, 50 - suite.name.length))}`);
      try {
        summaries.push(await suite.run());
      } catch (error) {
        console.log(`  ERRO NA SUÍTE: ${error.message}`);
        summaries.push({ suiteName: suite.name, total: 0, failed: [{ name: "suíte abortada", detail: error.message }] });
      }
    }
  } finally {
    stopApp();
    // Runs even when a suite throws: these tests favourite tracks, rename
    // playlists and change the accent colour on the real profile.
    const cleaned = restoreUserData();
    console.log(cleaned ? "\nArquivos temporários dos testes removidos." : "\nOs dados de teste ficaram em output/ para limpeza posterior.");
  }

  console.log("\n═══ Resumo ═══");
  let total = 0;
  let failures = 0;
  for (const summary of summaries) {
    const failed = summary.failed.length;
    total += summary.total;
    failures += failed;
    console.log(`  ${failed === 0 ? "OK  " : "FALHA"}  ${summary.suiteName}: ${summary.total - failed}/${summary.total}`);
    for (const item of summary.failed) console.log(`         - ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
  }
  console.log(`\n${total - failures}/${total} testes passaram`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("ERRO FATAL:", error.message);
  stopApp();
  restoreUserData();
  process.exit(1);
});
