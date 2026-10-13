const { createJob } = require("./jobFactory");

// Platform-agnostic download queue: owns job storage, FIFO scheduling and
// concurrency, and the (pure) status transitions — everything that doesn't
// need to know HOW a job actually gets downloaded.
//
// The "how" (spawning yt-dlp, reading its stdout, killing the process to
// pause/cancel) is owned entirely by the platform adapter, since that's
// exactly what differs between desktop (Node child_process) and mobile
// (a native ProcessBuilder plugin). The contract between the two:
//
//   - The adapter passes `onStart(job)` to the constructor. The queue calls
//     it once per job, right when a concurrency slot opens up. The adapter
//     is responsible for actually starting the process and must eventually
//     call one of `queue.patch()`, `queue.fail()`, `queue.complete()`, or
//     `queue.closeWithoutResult()` for that job id.
//   - Pause/resume/cancel are adapter-driven too, because only the adapter
//     holds the platform-specific process handle needed to kill it — the
//     queue just flips/validates job status and does the bookkeeping
//     (concurrency slot release, re-queueing, dropping from the pending
//     queue) around that.
class DownloadQueue {
  constructor({ maxConcurrent = 3, onStart, onUpdate, onComplete } = {}) {
    if (typeof onStart !== "function") {
      throw new Error("DownloadQueue requires an `onStart(job)` platform adapter callback.");
    }
    this._onStart = onStart;
    this._onUpdate = onUpdate || (() => {});
    this._onComplete = onComplete || (() => {});
    this.jobs = new Map(); // id -> job
    this.queue = []; // pending ids, FIFO
    this.activeIds = new Set(); // a slot remains owned until its native run stops
    this.activeCount = 0;
    this.maxConcurrent = maxConcurrent;
  }

  setMaxConcurrent(n) {
    this.maxConcurrent = Math.max(1, Math.min(20, n));
    this._pump();
  }

  addJob(fields) {
    const job = createJob(fields);
    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this._emit(job);
    this._pump();
    return job.id;
  }

  list() {
    return [...this.jobs.values()];
  }

  get(id) {
    return this.jobs.get(id) || null;
  }

  _pump() {
    let pendingToInspect = this.queue.length;
    while (this.activeCount < this.maxConcurrent && pendingToInspect-- > 0) {
      const id = this.queue.shift();
      const job = this.jobs.get(id);
      if (!job || job.status !== "aguardando") continue;
      if (this.activeIds.has(id)) {
        this.queue.push(id); // resume waits until the previous run really stops
        continue;
      }
      this.activeIds.add(id);
      this.activeCount += 1;
      job.status = "baixando";
      this._emit(job);
      // onStart is adapter-owned and may reject synchronously/asynchronously
      // (e.g. a malformed job with no url) — without this catch, that leaves
      // activeCount incremented forever with no way to release the slot.
      Promise.resolve()
        .then(() => this._onStart(job))
        .catch((e) => this.fail(id, e.message || String(e)));
    }
  }

  // Merges a partial state update into the job (progress/speed/eta/status/
  // filePath as parsed from process output) and re-emits. Does NOT touch
  // activeCount/scheduling — this is for in-flight progress, not completion.
  patch(id, partial) {
    const job = this.jobs.get(id);
    if (!job || job.status === "pausado" || job.status === "cancelado") return;
    Object.assign(job, partial);
    this._emit(job);
  }

  // Every terminal failure path needs the same three steps — centralizing
  // this guarantees none of them forget to release the concurrency slot or
  // re-pump the queue (a real bug in the original desktop-only code: a
  // forgotten decrement left a job stuck forever eating one of the
  // maxConcurrent slots).
  fail(id, message) {
    const job = this.jobs.get(id);
    if (!this._releaseSlot(id)) return;
    if (job && job.status !== "pausado" && job.status !== "cancelado") {
      job.status = "erro";
      job.error = message;
      this._emit(job);
    }
    this._pump();
  }

  complete(id, { filePath } = {}) {
    const job = this.jobs.get(id);
    if (!this._releaseSlot(id)) return;
    if (!job || job.status === "pausado" || job.status === "cancelado") {
      this._pump();
      return;
    }
    job.status = "concluído";
    job.progress = 1;
    if (filePath) job.filePath = filePath;
    this._emit(job);
    this._onComplete(job);
    this._pump();
  }

  // For when the adapter's process closed but the job had already been
  // marked cancelado/pausado by the user — just releases the slot, no
  // status change (the user-driven status already stands).
  closeWithoutResult(id) {
    if (this._releaseSlot(id)) this._pump();
  }

  _releaseSlot(id) {
    if (!this.activeIds.delete(id)) return false;
    this.activeCount -= 1;
    return true;
  }

  requestPause(id) {
    const job = this.jobs.get(id);
    if (!job || !["aguardando", "baixando", "convertendo"].includes(job.status)) return false;
    job.status = "pausado";
    this.queue = this.queue.filter((queuedId) => queuedId !== id);
    this._emit(job);
    return true;
  }

  requestResume(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status !== "pausado" && job.status !== "erro") return false;
    job.status = "aguardando";
    this._emit(job);
    this.queue.push(id);
    this._pump();
    return true;
  }

  requestCancel(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.status = "cancelado";
    this.queue = this.queue.filter((qid) => qid !== id);
    this._emit(job);
    this._pump();
    return true;
  }

  remove(id) {
    this.requestCancel(id);
    this.jobs.delete(id);
    return this.list();
  }

  _emit(job) {
    this._onUpdate(job);
  }
}

module.exports = { DownloadQueue };
