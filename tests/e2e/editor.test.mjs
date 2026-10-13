// Clip editor: trimming video, trimming audio, and animated exports.
//
// Every assertion inspects the file that actually landed on disk via ffprobe —
// "the app said it exported" is not evidence that anything playable was
// produced.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { Session, waitForTarget, sleep } from "./lib/cdp.mjs";
import { createReporter, pickLibraryFiles } from "./lib/harness.mjs";

const FFPROBE = path.resolve(
  import.meta.dirname,
  "../../resources/bin/ffprobe.exe"
);

const CLIP_SECONDS = 4;
const VIDEO_START = 5;
const AUDIO_START = 10;

function probeFile(filePath) {
  const output = execFileSync(
    FFPROBE,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { encoding: "utf8" }
  );
  const data = JSON.parse(output);
  const video = (data.streams || []).find((s) => s.codec_type === "video");
  const audio = (data.streams || []).find((s) => s.codec_type === "audio");
  return {
    duration: Number(data.format?.duration) || 0,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    width: video ? Number(video.width) : 0,
  };
}

const exportClip = (session, payload) =>
  session.evaluate(`window.aurora.exportClip(${JSON.stringify(payload)})`);

export default async function run() {
  const { check, summary } = createReporter("Editor de cortes");
  const produced = [];

  const target = await waitForTarget((t) => t.type === "page" && t.url.includes("index.html"), {
    label: "janela principal",
  });
  const session = await Session.open(target);

  const { video, audio } = pickLibraryFiles();
  if (!video || !audio) {
    check("biblioteca tem um vídeo e um áudio para testar", false, "faltam itens reproduzíveis");
    return summary();
  }

  try {
    // ----------------------------------------------------------------- probe
    const info = await session.evaluate(`window.aurora.probeMedia(${JSON.stringify(video.filePath)})`);
    check("probe retorna duração", info.duration > 0, `${info.duration.toFixed(2)}s`);
    check("probe detecta vídeo e áudio", info.hasVideo && info.hasAudio, `${info.width}x${info.height}`);

    const missing = await session.evaluate(
      `window.aurora.probeMedia("C:\\\\nao\\\\existe.mp4").then(() => "sem erro").catch((e) => e.message)`
    );
    check("probe de arquivo inexistente falha", /não encontrado/i.test(missing));

    // ------------------------------------------------------------ vídeo
    const precise = await exportClip(session, {
      filePath: video.filePath,
      start: VIDEO_START,
      end: VIDEO_START + CLIP_SECONDS,
      target: "video",
      options: { precise: true },
    });
    produced.push(precise.path);
    const preciseProbe = probeFile(precise.path);
    check(
      "corte preciso tem a duração selecionada",
      Math.abs(preciseProbe.duration - CLIP_SECONDS) < 0.35,
      `${preciseProbe.duration.toFixed(2)}s`
    );
    check("corte preciso reencoda em H.264", preciseProbe.videoCodec === "h264", preciseProbe.videoCodec ?? "");

    const fast = await exportClip(session, {
      filePath: video.filePath,
      start: VIDEO_START,
      end: VIDEO_START + CLIP_SECONDS,
      target: "video",
      options: { precise: false },
    });
    produced.push(fast.path);
    const fastProbe = probeFile(fast.path);
    // Stream copy snaps to a keyframe, so drift is expected and allowed — what
    // matters is that it produced a playable file without re-encoding.
    check("corte rápido gera arquivo válido", fastProbe.duration > 0 && fast.sizeBytes > 0, `${fastProbe.duration.toFixed(2)}s`);

    // ------------------------------------------------------------ áudio
    const kept = await exportClip(session, {
      filePath: audio.filePath,
      start: AUDIO_START,
      end: AUDIO_START + CLIP_SECONDS,
      target: "audio",
      options: { audioFormat: null },
    });
    produced.push(kept.path);
    const keptProbe = probeFile(kept.path);
    check("corte de áudio tem a duração selecionada", Math.abs(keptProbe.duration - CLIP_SECONDS) < 0.5, `${keptProbe.duration.toFixed(2)}s`);
    check("saída de áudio não tem faixa de vídeo", keptProbe.videoCodec === null);
    check(
      "manter formato preserva o codec original",
      keptProbe.audioCodec === probeFile(audio.filePath).audioCodec,
      keptProbe.audioCodec ?? ""
    );

    const converted = await exportClip(session, {
      filePath: audio.filePath,
      start: AUDIO_START,
      end: AUDIO_START + CLIP_SECONDS,
      target: "audio",
      options: { audioFormat: "wav" },
    });
    produced.push(converted.path);
    check("conversão para WAV usa PCM", (probeFile(converted.path).audioCodec || "").startsWith("pcm"));

    const extracted = await exportClip(session, {
      filePath: video.filePath,
      start: VIDEO_START,
      end: VIDEO_START + CLIP_SECONDS,
      target: "audio",
      options: { audioFormat: "mp3" },
    });
    produced.push(extracted.path);
    const extractedProbe = probeFile(extracted.path);
    check("extrair áudio de um vídeo funciona", extractedProbe.audioCodec === "mp3" && extractedProbe.videoCodec === null);

    // ------------------------------------------------------------ animações
    const gif = await exportClip(session, {
      filePath: video.filePath,
      start: VIDEO_START,
      end: VIDEO_START + 3,
      target: "gif",
      options: { fps: 12, width: 320 },
    });
    produced.push(gif.path);
    check("GIF gerado com a largura pedida", probeFile(gif.path).width === 320, `${(gif.sizeBytes / 1024).toFixed(0)} KB`);

    const leftovers = fs.readdirSync(path.dirname(gif.path)).filter((f) => f.endsWith(".palette.png"));
    check("paleta temporária foi removida", leftovers.length === 0, leftovers.join(", ") || "nenhuma");

    const webp = await exportClip(session, {
      filePath: video.filePath,
      start: VIDEO_START,
      end: VIDEO_START + 3,
      target: "webp",
      options: { fps: 12, width: 320 },
    });
    produced.push(webp.path);
    check(
      "WebP é bem menor que o GIF equivalente",
      webp.sizeBytes < gif.sizeBytes,
      `${(webp.sizeBytes / 1024).toFixed(0)} KB vs ${(gif.sizeBytes / 1024).toFixed(0)} KB`
    );

    // ------------------------------------------------------------ validações
    const inverted = await session.evaluate(
      `window.aurora.exportClip(${JSON.stringify({ filePath: video.filePath, start: 20, end: 10, target: "video" })}).then(() => "sem erro").catch((e) => e.message)`
    );
    check("seleção invertida é rejeitada", /início e um fim válidos/i.test(inverted));

    const absent = await session.evaluate(
      `window.aurora.exportClip(${JSON.stringify({ filePath: "C:\\\\nada.mp4", start: 0, end: 2, target: "video" })}).then(() => "sem erro").catch((e) => e.message)`
    );
    check("origem inexistente é rejeitada", /não encontrado/i.test(absent));

    const again = await exportClip(session, {
      filePath: video.filePath,
      start: VIDEO_START,
      end: VIDEO_START + 3,
      target: "gif",
      options: { fps: 12, width: 320 },
    });
    produced.push(again.path);
    check("exportar de novo não sobrescreve o anterior", again.path !== gif.path, path.basename(again.path));

    // ------------------------------------------------------------ interface
    await session.evaluate(
      `[...document.querySelectorAll('nav button')].find((b) => /Biblioteca|Library|Bibliothek|媒体库|ライブラリ|Библиотека/i.test(b.innerText)).click()`
    );
    await sleep(1200);
    const opened = await session.evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /Cortar|Trim|Recortar|Schneiden|裁剪|切り出し|Обрезать/.test(b.getAttribute('title') || ''));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    check("biblioteca oferece a ação de cortar", opened === true);
    await sleep(2200);

    const ui = await session.evaluate(`(() => {
      const labels = [...document.querySelectorAll('button')].map((b) => b.innerText.trim());
      return {
        timeline: !!document.querySelector('.trim-track [role="slider"]'),
        gif: labels.includes('GIF'),
        webp: labels.includes('WebP'),
        heading: document.querySelector('h1')?.innerText ?? '',
      };
    })()`);
    check("editor abre com a linha do tempo", ui.timeline === true);
    check("opções GIF e WebP disponíveis", ui.gif && ui.webp);
    // The editor was briefly announcing itself with the download page's heading
    // because Topbar had no entry for this view.
    check(
      "topbar mostra o título do editor",
      /Cortar|Trim|Recortar|Schneiden|裁剪|切り出し|Обрезка/i.test(ui.heading),
      ui.heading
    );
  } finally {
    for (const file of produced) fs.rmSync(file, { force: true });
    session.close();
  }

  return summary();
}
