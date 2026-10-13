// Turns the single accent colour stored in the profile into the three CSS
// variables the app paints from (--accent, --accent-soft, --accent-deep).
//
// Only one colour is stored because asking someone to pick three that work
// together is a design job, not a settings field — the lighter and darker
// companions are derived from it.

export const DEFAULT_ACCENT = "#7C6CFF";

const VARIABLES = ["--accent", "--accent-soft", "--accent-deep", "--on-accent"];

function parseHex(hex) {
  const match = /^#?([\da-f]{6})$/i.exec(String(hex ?? "").trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  };
}

const triple = ({ r, g, b }) => `${r} ${g} ${b}`;

// Companions shift lightness only, leaving hue and saturation intact — that
// keeps the three reading as one colour rather than three related ones. The
// clamps stop a near-white or near-black pick from producing a "soft" that is
// pure white or a "deep" that is pure black.
function derive(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const hsl = rgbToHsl(rgb);
  return {
    base: triple(rgb),
    soft: triple(hslToRgb({ ...hsl, l: Math.min(0.9, hsl.l + 0.08) })),
    deep: triple(hslToRgb({ ...hsl, l: Math.max(0.16, hsl.l - 0.2) })),
  };
}

export function isValidAccent(hex) {
  return parseHex(hex) !== null;
}

// Writes (or clears) the accent variables on <html>. The default colour
// deliberately *clears* them so the hand-tuned trio in index.css takes over —
// deriving it would give a slightly different soft/deep than the palette the
// app was designed around.
export function applyAccent(hex) {
  const root = document.documentElement;
  const normalized = String(hex ?? "").trim().toUpperCase();

  if (!normalized || normalized === DEFAULT_ACCENT || !isValidAccent(normalized)) {
    for (const name of VARIABLES) root.style.removeProperty(name);
    return DEFAULT_ACCENT;
  }

  const { base, soft, deep } = derive(normalized);
  root.style.setProperty("--accent", base);
  root.style.setProperty("--accent-soft", soft);
  root.style.setProperty("--accent-deep", deep);
  const rgb = parseHex(normalized);
  const channels = [rgb.r, rgb.g, rgb.b].map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  root.style.setProperty("--on-accent", luminance > .179 ? "16 18 25" : "255 255 255");
  return normalized;
}
