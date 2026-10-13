/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./mini.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // rgb(var(...) / <alpha-value>) is the standard Tailwind pattern for a
        // color that a CSS variable can repaint per-theme while opacity
        // modifiers (bg-base-900/50) keep working normally — see index.css for
        // the dark (:root) and light ([data-theme="light"]) variable values.
        base: {
          950: "rgb(var(--surface-950) / <alpha-value>)",
          900: "rgb(var(--surface-900) / <alpha-value>)",
          800: "rgb(var(--surface-800) / <alpha-value>)",
          700: "rgb(var(--surface-700) / <alpha-value>)",
          600: "rgb(var(--surface-600) / <alpha-value>)",
        },
        // The app's "foreground on glass" color — white text/borders/fills on
        // the dark theme's glass surfaces, near-black on the light theme's.
        // Anything meant to stay literally white regardless of theme (an icon
        // on a solid accent-gradient button, a video-overlay control) keeps
        // using the plain `white`/`black` Tailwind colors instead of `ink`.
        ink: "rgb(var(--ink) / <alpha-value>)",
        // Same variable indirection as `base`/`ink` above, for the same reason
        // plus one more: the accent is user-configurable (Perfil → cor de
        // destaque), so every `bg-accent`, `text-accent-soft` and
        // `from-accent`/`to-accent-deep` in the app repaints from a single
        // place instead of needing 45 call sites rewritten.
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          deep: "rgb(var(--accent-deep) / <alpha-value>)",
        },
        petrol: "#1B3A45",
        neon: "#7CFFE0",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "SF Pro Display",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glass: "0 20px 50px -20px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(124,108,255,0.4), 0 0 24px -4px rgba(124,108,255,0.55)",
      },
      borderRadius: {
        xl2: "20px",
      },
      transitionTimingFunction: {
        elegant: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        // Drives the mini player's animated border — the gradient is drawn at
        // 300% size so sliding its background-position sweeps a highlight
        // around the card. See components/mini/ShineBorder.jsx.
        "shine-pulse": {
          "0%": { "background-position": "0% 0%" },
          "50%": { "background-position": "100% 100%" },
          "100%": { "background-position": "0% 0%" },
        },
      },
    },
  },
  plugins: [],
};
