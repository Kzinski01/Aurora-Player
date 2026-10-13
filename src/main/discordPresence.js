const { Client } = require("@xhayper/discord-rpc");
const log = require("./logger");

// Discord Rich Presence needs an application registered at
// https://discord.com/developers/applications (free: New Application → name
// it → copy the Application ID from General Information — no bot user needed).
//
// This is intentionally *not* wired through Settings/electron-store: it
// identifies which application shows up in the user's Discord profile, not a
// per-user preference — same category of thing as the app's own name or icon.
const DISCORD_CLIENT_ID = "1533282520664244254";
const PLACEHOLDER_CLIENT_ID = "REPLACE_WITH_YOUR_DISCORD_APPLICATION_CLIENT_ID";

// ActivityType.Listening — renders the card with a "Ouvindo Aurora
// Downloader" header and a music-player layout instead of a game card.
const ACTIVITY_TYPE_LISTENING = 2;

// Discord silently drops an image whose URL is longer than this, leaving a
// blank cover. YouTube thumbnails fit comfortably; signed CDN links (Instagram)
// routinely run past 700 characters, so those fall back to the uploaded asset.
const MAX_IMAGE_URL_LENGTH = 256;

// Discord buttons must point at a URL, so "open the app" is expressed as a
// custom-protocol link that main.js registers and turns into a window focus.
const AURORA_DEEP_LINK = "aurora://play";

const FIELD_MAX_LENGTH = 128;
const FIELD_MIN_LENGTH = 2;
const ZERO_WIDTH_SPACE = "​";

// Discord's local RPC server only exists while the desktop client is running.
// Users habitually start Discord *after* their other apps, so a single failed
// attempt at startup would mean no presence for the whole session.
const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 30;

// A track left paused indefinitely shouldn't keep advertising itself — but a
// brief pause shouldn't make the card flicker away and back either.
const CLEAR_WHILE_PAUSED_MS = 30000;

// Re-deriving the end timestamp on every push makes it drift by a second or
// so each time, and Discord redraws the progress bar on any change — which
// reads as a stuttering bar. Reuse the previous value while it's this close.
const TIMESTAMP_DRIFT_TOLERANCE_MS = 2000;

let client = null;
let ready = false;
let enabled = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let clearWhilePausedTimer = null;
let lastActivitySignature = null;
let lastEndTimestamp = null;

function isConfigured() {
  return !!DISCORD_CLIENT_ID && DISCORD_CLIENT_ID !== PLACEHOLDER_CLIENT_ID;
}

// Discord rejects the whole payload if a text field is under 2 characters, so
// pad short ones invisibly rather than substituting different text — a track
// genuinely titled "4" should still read as "4".
function fitField(text, fallback = "") {
  const value = (text || "").trim() || fallback;
  if (value.length > FIELD_MAX_LENGTH) return `${value.slice(0, FIELD_MAX_LENGTH - 3)}...`;
  return value.length < FIELD_MIN_LENGTH ? value.padEnd(FIELD_MIN_LENGTH, ZERO_WIDTH_SPACE) : value;
}

function usableImageUrl(thumbnail) {
  const url = thumbnail || "";
  return /^https?:\/\//.test(url) && url.length <= MAX_IMAGE_URL_LENGTH ? url : undefined;
}

function clearTimer(timer) {
  if (timer) clearTimeout(timer);
  return null;
}

function scheduleReconnect() {
  if (!enabled || reconnectTimer) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    log.info("discord", "Discord não encontrado após várias tentativas. Rich Presence ficará inativo nesta sessão");
    return;
  }
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
}

// Talks to the local Discord desktop client over its IPC pipe — there's
// nothing to connect to if Discord isn't running, which is a normal, expected
// state (not an error), so failures here are logged at info level and retried
// quietly rather than surfaced to the user.
async function connect() {
  if (!enabled || !isConfigured() || client) return;

  client = new Client({ clientId: DISCORD_CLIENT_ID });
  client.on("ready", () => {
    ready = true;
    reconnectAttempts = 0;
    log.info("discord", "conectado ao Rich Presence");
  });
  client.on("disconnected", () => {
    ready = false;
    // The activity died with the connection, so the next push has to be sent
    // even if it's identical to what we last sent over the old one.
    lastActivitySignature = null;
    log.info("discord", "conexão com o Discord encerrada. Tentando reconectar");
    scheduleReconnect();
  });

  try {
    await client.login();
  } catch (e) {
    client = null;
    log.info("discord", "Discord indisponível no momento", { message: e.message, tentativa: reconnectAttempts });
    scheduleReconnect();
  }
}

async function disconnect() {
  ready = false;
  reconnectTimer = clearTimer(reconnectTimer);
  clearWhilePausedTimer = clearTimer(clearWhilePausedTimer);
  lastActivitySignature = null;
  lastEndTimestamp = null;
  if (!client) return;
  try {
    await client.destroy();
  } catch (e) {
    log.warn("discord", "falha ao encerrar a conexão com o Discord", { message: e.message });
  }
  client = null;
}

// Called once at startup and again whenever the user flips the Settings
// toggle — both paths just reconcile "should be connected" vs. "is connected"
// so there's one code path instead of two.
async function setEnabled(next) {
  enabled = next;
  reconnectAttempts = 0;
  if (enabled) await connect();
  else await disconnect();
}

// Keeps the bar anchored while playback runs uninterrupted; a seek or a track
// change moves it past the tolerance and correctly produces a new anchor.
function stableEndTimestamp(elapsedSec, durationSec) {
  const endTimestamp = Date.now() + Math.round((durationSec - (elapsedSec || 0)) * 1000);
  if (lastEndTimestamp !== null && Math.abs(endTimestamp - lastEndTimestamp) <= TIMESTAMP_DRIFT_TOLERANCE_MS) {
    return lastEndTimestamp;
  }
  lastEndTimestamp = endTimestamp;
  return endTimestamp;
}

function buildActivity({ title, uploader, thumbnail, url, subtitle, isPlaying, elapsedSec, durationSec }) {
  const details = fitField(title, "Aurora Downloader");
  const activity = {
    type: ACTIVITY_TYPE_LISTENING,
    details,
    state: fitField(uploader || subtitle, isPlaying ? "Reproduzindo" : "Pausado"),
    // The cover goes in largeImageKey (assets.large_image), which is what
    // Discord actually renders — largeImageUrl is assets.large_url, a
    // click-through link on the artwork, and putting the thumbnail there
    // leaves the card showing a missing-asset placeholder instead.
    //
    // "aurora_logo" is only reached when there's no usable thumbnail, and it
    // renders as a placeholder unless an asset with that exact name has been
    // uploaded under Rich Presence → Art Assets in the Discord dev portal.
    largeImageKey: usableImageUrl(thumbnail) || "aurora_logo",
    // No largeImageText: Discord surfaces it as an extra line on the card,
    // where it just repeated the title already shown in `details`.
    instance: false,
  };

  if (/^https?:\/\//.test(url || "")) activity.largeImageUrl = url;

  // Discord only draws the progress bar while both timestamps are present,
  // and it keeps counting on its own — so a paused track must drop them
  // entirely, otherwise the bar would advance past where playback actually is.
  if (isPlaying && durationSec > 0) {
    const endTimestamp = stableEndTimestamp(elapsedSec, durationSec);
    activity.startTimestamp = endTimestamp - Math.round(durationSec * 1000);
    activity.endTimestamp = endTimestamp;
  } else {
    lastEndTimestamp = null;
  }

  const buttons = [];
  if (/^https?:\/\//.test(url || "")) buttons.push({ label: "Assistir no navegador", url });
  buttons.push({ label: "Abrir no Aurora", url: AURORA_DEEP_LINK });
  activity.buttons = buttons;

  return activity;
}

// Discord rate-limits presence updates, and the renderer pushes on every
// play/pause/metadata event — so only actually send when the rendered card
// would differ from the one already on screen.
function activitySignature(activity) {
  return JSON.stringify([
    activity.details,
    activity.state,
    activity.largeImageKey,
    activity.endTimestamp,
  ]);
}

// Stops advertising a track that has sat paused long enough to be abandoned,
// without flickering the card away during a normal short pause.
function scheduleClearWhilePaused(isPlaying) {
  clearWhilePausedTimer = clearTimer(clearWhilePausedTimer);
  if (isPlaying) return;
  clearWhilePausedTimer = setTimeout(() => {
    clearWhilePausedTimer = null;
    clearActivity();
  }, CLEAR_WHILE_PAUSED_MS);
}

// { title, uploader, thumbnail, url, subtitle, isPlaying, elapsedSec, durationSec }.
// Timestamps (not a repeated per-second update) drive Discord's own live
// progress bar, so this only needs to fire on track/play-state changes, not
// every tick — see bindMediaEvents in usePlayerStore.
function setActivity(track) {
  if (!enabled || !ready || !client) return;

  const activity = buildActivity(track);
  const signature = activitySignature(activity);
  scheduleClearWhilePaused(track.isPlaying);
  if (signature === lastActivitySignature) return;
  lastActivitySignature = signature;

  client.user?.setActivity(activity).catch((e) => log.warn("discord", "falha ao atualizar presence", { message: e.message }));
}

function clearActivity() {
  clearWhilePausedTimer = clearTimer(clearWhilePausedTimer);
  lastActivitySignature = null;
  lastEndTimestamp = null;
  if (!enabled || !ready || !client) return;
  client.user?.clearActivity().catch(() => {});
}

module.exports = { setEnabled, setActivity, clearActivity, disconnect, isConfigured };
