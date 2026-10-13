// Rough byte estimate for an animated export, so the editor can warn before
// someone waits on a 40 MB GIF.
//
// Lives in the renderer rather than in aurora-core because nothing in the main
// process needs it: it exists purely to decide what the UI says. (The renderer
// is ESM bundled by Vite and aurora-core is CommonJS, so anything shared has to
// earn the interop.)
//
// Accurate to roughly a factor of two, which is all that's needed to tell
// "fine" from "far too big". Derived from typical 8-bit palettised output —
// real sizes swing with how much motion the clip contains, since both formats
// encode the difference between frames.
const GIF_BYTES_PER_PIXEL_FRAME = 0.16;
const WEBP_BYTES_PER_PIXEL_FRAME = 0.035;

export function estimateAnimatedSize({ target, width, height, fps, duration }) {
  if (!width || !height || !fps || !duration) return 0;
  const perPixelFrame = target === "webp" ? WEBP_BYTES_PER_PIXEL_FRAME : GIF_BYTES_PER_PIXEL_FRAME;
  return Math.round(width * height * fps * duration * perPixelFrame);
}
