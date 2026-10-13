// The audio formats the app offers, in one place. Previously this list was
// spelled out separately in the download result card and again in the clip
// editor, which meant adding a format was two edits with nothing to catch the
// one you forgot.
//
// The main process has its own copy in aurora-core (it drives yt-dlp and ffmpeg
// arguments); that duplication is deliberate, since the renderer is ESM bundled
// by Vite and aurora-core is CommonJS.
export const AUDIO_FORMATS = ["mp3", "flac", "wav", "aac", "opus", "m4a"];

export const AUDIO_FORMAT_OPTIONS = AUDIO_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));
