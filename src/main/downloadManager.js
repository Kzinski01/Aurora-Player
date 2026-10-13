const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const {
  DownloadQueue,
  buildYtDlpArgs,
  parseProgressLine,
  normalizeMetadata,
  unwrapSearchResult,
  friendlyError,
  upsertLibraryEntry,
  AUDIO_FORMATS,
} = require("aurora-core");
const { ensureYtDlp, ensureFfmpeg } = require("./binaries");
const log = require("./logger");
const { syncFromDisk, annotateLibraryWithPlaylists } = require("./playlistSync");
const { loadLibrary, saveLibrary } = require("./libraryStore");
const { incrementDownloadCount } = require("./profileStore");
const { validateMediaUrl, validateMetadataInput, safeThumbnailUrl, playlistOutputDir } = require("./downloadInput");
const { playlistMetadata, playlistJobFields } = require("./playlistPlan");

function downloadError(raw) {
  const message = String(raw || "");
  if (/ENOSPC|No space left on device/i.test(message)) return "Espaço em disco insuficiente para o download.";
  if (/EACCES|EPERM|Permission denied/i.test(message)) return "Sem permissão para gravar na pasta de destino.";
  if (/private playlist|playlist is private/i.test(message)) return "Esta playlist é privada e não pode ser baixada.";
  if (/already exists|File exists/i.test(message)) return "O arquivo já existe na pasta de destino.";
  return friendlyError(message);
}

// This class is the desktop *adapter*: it owns everything platform-specific
// (spawning yt-dlp via child_process, reading its stdout, killing the
// process to pause/cancel, writing to userData files) and delegates
// scheduling/state-transition bookkeeping to aurora-core's DownloadQueue.
// See aurora-core/src/downloadQueue.js for the contract this implements.
class DownloadManager {
  constructor(win, store) {
    this.win = win;
    this.store = store;
    this.procs = new Map(); // id -> ChildProcess, kept out of the (JSON-safe) job object
    this.stopReasons = new Map();
    this.metadataProcs = new Set();
    this.playlists = new Map();
    this.playlistByJob = new Map();
    this.analyzedPlaylists = new Map();
    this.lastProgressSent = new Map();
    this.queue = new DownloadQueue({
      maxConcurrent: store.get("maxConcurrent", 3),
      onUpdate: (job) => this._onJobUpdate(job),
      onStart: (job) => this._runJob(job),
    });
  }

  send(channel, payload) {
    if (!this.win || this.win.isDestroyed() || this.win.webContents.isDestroyed?.()) return;
    try { this.win.webContents.send(channel, payload); }
    catch (error) { log.warn("download", "falha ao atualizar a interface", { channel, message: error.message }); }
  }

  setMaxConcurrent(n) {
    if (!Number.isInteger(n) || n < 1 || n > 20) throw new Error("Limite de downloads inválido.");
    this.store.set("maxConcurrent", n);
    this.queue.setMaxConcurrent(n);
  }

  // Accepts either a real URL or a bare search query — "ytsearch1:<query>" is
  // yt-dlp's own syntax for "resolve to the top result", so a plain text
  // search reuses the exact same metadata/download path as a pasted link.
  async fetchMetadata(urlOrQuery) {
    const input = validateMetadataInput(urlOrQuery);
    const ytDlp = await ensureYtDlp();
    return new Promise((resolve, reject) => {
      const isSearch = input.startsWith("ytsearch1:");
      const args = ["--ignore-config", "--no-plugin-dirs", "-J", "--no-warnings", ...(isSearch ? ["--no-playlist"] : ["--flat-playlist", "--yes-playlist"]), "--", input];
      const proc = spawn(ytDlp, args, { windowsHide: true });
      this.metadataProcs.add(proc);
      let out = "";
      let err = "";
      let settled = false;
      const finish = (error, metadata) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.metadataProcs.delete(proc);
        error ? reject(error) : resolve(metadata);
      };
      const timeout = setTimeout(() => { this._stopProcess(proc); finish(new Error("Tempo limite ao analisar o link.")); }, 60000);
      proc.stdout.on("data", (d) => {
        out += d.toString();
        if (out.length > 64 * 1024 * 1024) { this._stopProcess(proc); finish(new Error("A playlist é grande demais para analisar.")); }
      });
      proc.stderr.on("data", (d) => (err = (err + d.toString()).slice(-4000)));
      proc.on("close", (code) => {
        if (code !== 0) {
          finish(new Error(downloadError(err.trim()) || `yt-dlp saiu com código ${code}`));
          return;
        }
        try {
          const info = isSearch ? unwrapSearchResult(JSON.parse(out)) : JSON.parse(out);
          const metadata = info._type === "playlist" && !isSearch
            ? playlistMetadata(info, input)
            : normalizeMetadata(info);
          if (metadata.isPlaylist) {
            this.analyzedPlaylists.set(input, metadata);
            if (this.analyzedPlaylists.size > 5) this.analyzedPlaylists.delete(this.analyzedPlaylists.keys().next().value);
          }
          else {
            metadata.url = validateMediaUrl(metadata.url || input);
            metadata.thumbnail = safeThumbnailUrl(metadata.thumbnail);
          }
          finish(null, metadata);
        } catch (e) {
          finish(e.message === "Nenhum resultado encontrado." ? e : new Error("Não foi possível interpretar os metadados."));
        }
      });
      proc.on("error", (e) => finish(new Error(downloadError(e.message))));
    });
  }

  addJob({ url, title, uploader, thumbnail, mode, resolution, audioFormat, outputDir }, internalPlaylist = false) {
    url = validateMediaUrl(url);
    if (!["audio", "video"].includes(mode)) throw new Error("Tipo de download inválido.");
    if (audioFormat && !AUDIO_FORMATS.has(audioFormat)) throw new Error("Formato de áudio inválido.");
    if (resolution != null && resolution !== "" && (!Number.isInteger(Number(resolution)) || Number(resolution) < 1 || Number(resolution) > 4320)) {
      throw new Error("Resolução inválida.");
    }
    const destination = outputDir || this.store.get("downloadDir");
    if (typeof destination !== "string" || !path.isAbsolute(destination)) throw new Error("Pasta de download inválida.");
    if (destination.length > 210) throw new Error("O caminho da pasta de download é longo demais.");
    if (!internalPlaylist && path.resolve(destination).toLowerCase() !== path.resolve(this.store.get("downloadDir")).toLowerCase()) {
      throw new Error("Escolha a pasta de download nas configurações.");
    }
    const id = this.queue.addJob({
      url,
      title,
      uploader,
      thumbnail: safeThumbnailUrl(thumbnail),
      mode,
      resolution,
      audioFormat,
      outputDir: destination,
    });
    log.info("download", "job criado", { id, url, mode, outputDir: this.queue.get(id).outputDir });
    return id;
  }

  list() {
    return this.queue.list();
  }

  listPlaylists() { return [...this.playlists.values()].map((group) => this._groupSummary(group)); }

  async addPlaylist({ url, mode, resolution, audioFormat, outputDir }) {
    const playlistUrl = validateMediaUrl(url);
    const metadata = this.analyzedPlaylists.get(playlistUrl) || await this.fetchMetadata(playlistUrl);
    if (!metadata.isPlaylist || !metadata.items.length) throw new Error("Nenhuma playlist com itens foi encontrada.");
    if (!["audio", "video"].includes(mode)) throw new Error("Tipo de download inválido.");
    if (audioFormat && !AUDIO_FORMATS.has(audioFormat)) throw new Error("Formato de áudio inválido.");
    if (resolution != null && resolution !== "" && (!Number.isInteger(Number(resolution)) || Number(resolution) < 1 || Number(resolution) > 4320)) throw new Error("Resolução inválida.");
    const destination = outputDir || this.store.get("downloadDir");
    if (typeof destination !== "string" || !path.isAbsolute(destination)) throw new Error("Pasta de download inválida.");
    if (playlistOutputDir(destination, metadata.title).length > 210) throw new Error("O caminho da playlist é longo demais.");
    if (path.resolve(destination).toLowerCase() !== path.resolve(this.store.get("downloadDir")).toLowerCase()) {
      throw new Error("Escolha a pasta de download nas configurações.");
    }
    const group = {
      id: crypto.randomUUID(), title: metadata.title, url: playlistUrl,
      items: metadata.items, mode, resolution, audioFormat,
      outputDir: destination,
      status: "baixando", completed: 0, skipped: [], cursor: 0, currentJobId: null,
    };
    this.playlists.set(group.id, group);
    this.analyzedPlaylists.delete(playlistUrl);
    if (this.playlists.size > 20) {
      const oldId = [...this.playlists].find(([, old]) => old.status !== "baixando")?.[0];
      if (oldId) this.playlists.delete(oldId);
    }
    this._startNextPlaylistItem(group);
    return group.id;
  }

  cancelPlaylist(id) {
    const group = this.playlists.get(id);
    if (!group || group.status !== "baixando") return false;
    group.status = "cancelado";
    if (group.currentJobId) this.cancel(group.currentJobId);
    this._sendPlaylist(group);
    return true;
  }

  _groupSummary(group) {
    const candidate = group.currentJobId ? this.queue.get(group.currentJobId) : null;
    const current = candidate && ["baixando", "convertendo", "aguardando", "pausado"].includes(candidate.status) ? candidate : null;
    return {
      id: group.id, title: group.title, status: group.status,
      total: group.items.length, completed: group.completed,
      skipped: group.skipped, currentIndex: current?.playlistIndex || group.cursor,
      currentTitle: current?.title || "", itemProgress: current?.progress || 0,
      totalProgress: (group.completed + group.skipped.length + (current?.progress || 0)) / group.items.length,
      speed: current?.speed || "", eta: current?.eta || "", sizeText: current?.sizeText || "",
      outputDir: playlistOutputDir(group.outputDir, group.title),
    };
  }

  _sendPlaylist(group) { this.send("playlistDownload:update", this._groupSummary(group)); }

  _startNextPlaylistItem(group) {
    if (group.status !== "baixando") return;
    while (group.cursor < group.items.length && !group.items[group.cursor].url) {
      const item = group.items[group.cursor++];
      group.skipped.push({ position: item.position, title: item.title, reason: "Item indisponível." });
    }
    if (group.cursor === group.items.length) {
      group.status = "concluído";
      group.currentJobId = null;
      this._sendPlaylist(group);
      return;
    }
    const item = group.items[group.cursor++];
    try {
      const id = this.addJob(playlistJobFields(group, item), true);
      const job = this.queue.get(id);
      job.playlistId = group.id;
      job.playlistIndex = item.position;
      group.currentJobId = id;
      this.playlistByJob.set(id, group.id);
      this._sendPlaylist(group);
    } catch (e) {
      group.skipped.push({ position: item.position, title: item.title, reason: e.message });
      queueMicrotask(() => this._startNextPlaylistItem(group));
    }
  }

  _onJobUpdate(job) {
    const previous = this.lastProgressSent.get(job.id);
    const now = Date.now();
    const terminal = ["concluído", "erro", "cancelado", "pausado"].includes(job.status);
    const shouldSend = terminal || !previous || previous.status !== job.status || now - previous.time >= 100;
    if (shouldSend) {
      this.send("download:update", job);
      if (terminal) this.lastProgressSent.delete(job.id);
      else this.lastProgressSent.set(job.id, { status: job.status, time: now });
    }
    const group = this.playlists.get(this.playlistByJob.get(job.id));
    if (!group) return;
    if (job.status === "concluído" || job.status === "erro") {
      this.playlistByJob.delete(job.id);
      if (job.status === "concluído") group.completed += 1;
      else group.skipped.push({ position: job.playlistIndex, title: job.title, reason: job.error || "Falha no download." });
      this._sendPlaylist(group);
      queueMicrotask(() => this._startNextPlaylistItem(group));
    } else if (shouldSend) {
      this._sendPlaylist(group);
    }
  }

  _finishCanceledPlaylistItem(job) {
    const group = this.playlists.get(this.playlistByJob.get(job.id));
    if (!group) return;
    this.playlistByJob.delete(job.id);
    if (group.status !== "baixando") return;
    group.skipped.push({ position: job.playlistIndex, title: job.title, reason: "Download cancelado." });
    this._sendPlaylist(group);
    queueMicrotask(() => this._startNextPlaylistItem(group));
  }

  pause(id) {
    const ok = this.queue.requestPause(id);
    if (!ok) {
      log.warn("download", "pause ignorado (estado não permite pausar)", { id });
      return;
    }
    const proc = this.procs.get(id);
    if (proc) {
      this.stopReasons.set(id, "pause");
      this._stopProcess(proc);
    }
    log.info("download", "pause solicitado", { id });
  }

  resume(id) {
    const ok = this.queue.requestResume(id);
    if (!ok) {
      log.warn("download", "resume ignorado (job inexistente ou em estado que não permite retomar)", { id });
      return;
    }
    log.info("download", "resume solicitado", { id });
  }

  cancel(id) {
    const ok = this.queue.requestCancel(id);
    if (!ok) {
      log.warn("download", "cancel ignorado (job inexistente)", { id });
      return;
    }
    const proc = this.procs.get(id);
    if (proc) {
      this.stopReasons.set(id, "cancel");
      this._stopProcess(proc);
    }
    log.info("download", "job cancelado pelo usuário", { id });
  }

  remove(id) {
    const playlistId = this.playlistByJob.get(id);
    if (playlistId) this.cancelPlaylist(playlistId);
    this.playlistByJob.delete(id);
    const proc = this.procs.get(id);
    if (proc) this._stopProcess(proc);
    return this.queue.remove(id);
  }

  _stopProcess(proc) {
    if (!proc.pid) return proc.kill();
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true });
      killer.on("error", () => proc.kill());
      killer.on("close", (code) => { if (code !== 0 && proc.exitCode === null) proc.kill(); });
    } else {
      proc.kill();
    }
  }

  shutdown() {
    for (const group of this.playlists.values()) this.cancelPlaylist(group.id);
    for (const job of this.queue.list()) {
      if (["aguardando", "baixando", "convertendo", "pausado"].includes(job.status)) this.cancel(job.id);
    }
    for (const proc of this.metadataProcs) this._stopProcess(proc);
  }

  // Adapter-owned: actually spawns yt-dlp for a job the queue just marked
  // "baixando", wires up progress parsing, and reports back to the queue via
  // patch/fail/complete/closeWithoutResult as required by its contract.
  async _runJob(job) {
    if (!job.url || typeof job.url !== "string") {
      log.error("download", "job sem url válida. Abortado antes de iniciar o yt-dlp", { id: job.id, title: job.title });
      this.queue.fail(job.id, "Link inválido ou ausente para esta faixa.");
      return;
    }

    let ytDlp, ffmpeg;
    try {
      ytDlp = await ensureYtDlp();
      ffmpeg = ensureFfmpeg();
    } catch (e) {
      log.error("download", "falha ao preparar yt-dlp/ffmpeg", { id: job.id, message: e.message, stack: e.stack });
      this.queue.fail(job.id, "Falha ao preparar yt-dlp/ffmpeg: " + e.message);
      if (this.queue.get(job.id)?.status === "cancelado") this._finishCanceledPlaylistItem(job);
      return;
    }

    if (this.queue.get(job.id)?.status !== "baixando") {
      this.queue.closeWithoutResult(job.id);
      this._finishCanceledPlaylistItem(job);
      return;
    }

    try {
      fs.mkdirSync(job.outputDir, { recursive: true });
    } catch (e) {
      log.error("download", "falha ao criar pasta de destino", { id: job.id, outputDir: job.outputDir, message: e.message });
      this.queue.fail(job.id, downloadError(e.message));
      if (this.queue.get(job.id)?.status === "cancelado") this._finishCanceledPlaylistItem(job);
      return;
    }

    if (this.queue.get(job.id)?.status !== "baixando") {
      this.queue.closeWithoutResult(job.id);
      this._finishCanceledPlaylistItem(job);
      return;
    }
    const prefix = job.playlistIndex ? `${String(job.playlistIndex).padStart(3, "0")} - ` : "";
    const maxTitleBytes = Math.max(20, Math.min(100, 235 - job.outputDir.length - prefix.length));
    const outTemplate = path.join(job.outputDir, `${prefix}%(title).${maxTitleBytes}B.%(ext)s`);
    const args = buildYtDlpArgs(job, { outTemplate, ffmpegPath: ffmpeg });
    args.unshift("--ignore-config", "--no-plugin-dirs");
    args.splice(-1, 0, "--windows-filenames", "--no-overwrites", "--continue", "--print", "after_move:AURORA_FILE:%(filepath)s", "--");
    log.info("download", "iniciando processo yt-dlp", { id: job.id, mode: job.mode });

    let proc;
    try {
      proc = spawn(ytDlp, args, { windowsHide: true });
    } catch (e) {
      log.error("download", "spawn do yt-dlp falhou", { id: job.id, message: e.message, stack: e.stack });
      this.queue.fail(job.id, "Falha ao iniciar o yt-dlp: " + e.message);
      if (this.queue.get(job.id)?.status === "cancelado") this._finishCanceledPlaylistItem(job);
      return;
    }
    this.procs.set(job.id, proc);

    let rawOutput = "";
    const pending = { stdout: "", stderr: "" };
    const processLine = (line) => {
      if (line.startsWith("AURORA_FILE:")) {
        this.queue.patch(job.id, { filePath: line.slice("AURORA_FILE:".length).trim() });
        return;
      }
      const patch = parseProgressLine(line);
      if (patch) this.queue.patch(job.id, patch);
    };
    const capture = (stream, chunk) => {
      const text = chunk.toString();
      rawOutput += text;
      if (rawOutput.length > 20000) rawOutput = rawOutput.slice(-20000); // keep it bounded
      const lines = (pending[stream] + text).split(/\r|\n/);
      pending[stream] = lines.pop() || "";
      for (const line of lines) processLine(line);
    };
    proc.stdout.on("data", (chunk) => capture("stdout", chunk));
    proc.stderr.on("data", (chunk) => capture("stderr", chunk));

    proc.on("close", (code) => {
      processLine(pending.stdout);
      processLine(pending.stderr);
      this.procs.delete(job.id);
      const stopReason = this.stopReasons.get(job.id);
      this.stopReasons.delete(job.id);
      const current = this.queue.get(job.id);
      if (!current) {
        this.playlistByJob.delete(job.id);
        this.queue.closeWithoutResult(job.id);
        return;
      }
      if (current.status === "cancelado" || stopReason === "cancel") {
        log.info("download", "job cancelado", { id: job.id });
        this.queue.closeWithoutResult(job.id);
        this._finishCanceledPlaylistItem(current);
      } else if (current.status === "pausado" || stopReason === "pause") {
        log.info("download", "job pausado", { id: job.id });
        this.queue.closeWithoutResult(job.id);
      } else if (code === 0) {
        if (!current.filePath || !fs.existsSync(current.filePath)) {
          log.error("download", "processo terminou sem arquivo final válido", { id: job.id, filePath: current.filePath });
          this.queue.fail(job.id, "O download terminou, mas o arquivo final não foi encontrado.");
          return;
        }
        log.info("download", "job concluído", { id: job.id, filePath: current.filePath });
        try {
          this._addToLibrary(current);
        } catch (error) {
          log.error("library", "download não pôde ser gravado na biblioteca", { id: job.id, message: error.message });
          this.queue.fail(job.id, "Arquivo baixado, mas não foi possível salvar a biblioteca. Verifique a pasta de dados do Aurora.");
          return;
        }
        this.queue.complete(job.id);
      } else {
        const errorLines = rawOutput
          .split(/\r?\n/)
          .filter((l) => /^ERROR:/.test(l.trim()))
          .map((l) => l.trim());
        const message = downloadError(errorLines[errorLines.length - 1]) || current.error || `Processo finalizado com código ${code}`;
        log.error("download", "job terminou com erro", { id: job.id, code, error: message, saidaCompleta: rawOutput.slice(-4000) });
        this.queue.fail(job.id, message);
      }
    });

    proc.on("error", (e) => {
      this.procs.delete(job.id);
      const stopReason = this.stopReasons.get(job.id);
      this.stopReasons.delete(job.id);
      if (stopReason) {
        this.queue.closeWithoutResult(job.id);
        if (stopReason === "cancel") this._finishCanceledPlaylistItem(job);
        return;
      }
      log.error("download", "erro ao executar processo yt-dlp", { id: job.id, message: e.message, stack: e.stack });
      this.queue.fail(job.id, downloadError(e.message));
      if (this.queue.get(job.id)?.status === "cancelado") this._finishCanceledPlaylistItem(job);
    });
  }

  _addToLibrary(job) {
    const library = loadLibrary();
    const { library: nextLibrary, wasRestored } = upsertLibraryEntry(library, job);

    log.info(
      "library",
      wasRestored ? "item removido foi restaurado por um novo download" : "item existente ou novo atualizado por um novo download",
      { id: job.id, title: job.title }
    );

    saveLibrary(nextLibrary);
    log.info("library", "item adicionado à biblioteca", { id: job.id, title: job.title, totalCount: nextLibrary.length });
    try { incrementDownloadCount(); } catch (e) { log.warn("profile", "falha ao atualizar contagem de downloads", { message: e.message }); }

    try {
      const playlists = syncFromDisk();
      this.send("playlists:update", playlists);
    } catch (e) {
      log.error("playlists", "falha ao ressincronizar playlists após download", { message: e.message });
    }
    try { this.send("library:update", annotateLibraryWithPlaylists(nextLibrary)); }
    catch (e) { log.warn("library", "falha ao atualizar a interface da biblioteca", { message: e.message }); }
  }
}

module.exports = { DownloadManager, AUDIO_FORMATS };
