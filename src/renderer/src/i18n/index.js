import studio from "./studio.js";
import { useMemo } from "react";
import useDownloadStore from "../store/useDownloadStore.js";
import ptBR from "./locales/pt-BR.js";
import en from "./locales/en.js";
import es from "./locales/es.js";
import de from "./locales/de.js";
import ja from "./locales/ja.js";
import zh from "./locales/zh.js";
import ru from "./locales/ru.js";

export const DEFAULT_LANGUAGE = "pt-BR";

// Native names, so each language reads its own name correctly in the picker
// regardless of which language is currently active.
export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", nativeName: "Português (Brasil)" },
  { code: "en", nativeName: "English" },
  { code: "es", nativeName: "Español" },
  { code: "de", nativeName: "Deutsch" },
  { code: "ja", nativeName: "日本語" },
  { code: "zh", nativeName: "中文（简体）" },
  { code: "ru", nativeName: "Русский" },
];

const DICTIONARIES = Object.fromEntries(Object.entries({ "pt-BR": ptBR, en, es, de, ja, zh, ru }).map(([language, dict]) => [language, { ...dict, studio: studio[language] }]));

function resolvePath(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? node : node[part]), dict);
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] ?? `{{${name}}}`));
}

// Every locale falls back to pt-BR (the source dictionary — see locales/pt-BR.js)
// for any key it hasn't translated yet, so an incomplete translation degrades
// to the app's own source language instead of showing a raw "some.key.path".
// Exported for the mini player, which lives in its own window and receives its
// language over IPC instead of from useDownloadStore — so it needs the plain
// function, not the hook built on top of it.
export function translate(language, key, vars) {
  const dict = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE];
  const value = resolvePath(dict, key) ?? resolvePath(DICTIONARIES[DEFAULT_LANGUAGE], key);
  if (value == null) return key;
  return typeof value === "string" ? interpolate(value, vars) : value;
}

// Counts follow each language's own plural rule via Intl.PluralRules — e.g.
// Russian's one/few/many/other — instead of a hand-rolled n===1 check that
// would be outright wrong for most of the languages this covers. `key` must
// resolve to an object of category → template (see any locale's "*Toast"
// entries); `count` is auto-injected into the template as {{count}}.
function translatePlural(language, key, count, vars) {
  const dict = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE];
  const forms = resolvePath(dict, key) ?? resolvePath(DICTIONARIES[DEFAULT_LANGUAGE], key);
  if (forms == null) return key;
  const category = new Intl.PluralRules(language).select(count);
  const text = forms[category] ?? forms.other ?? Object.values(forms)[0];
  return interpolate(text, { count, ...vars });
}

// Settings already flow through useDownloadStore (loadSettings/patchSettings —
// see SettingsPage), so language rides the same async-loaded, IPC-persisted
// path as every other preference instead of a separate store.
export function useTranslation() {
  const language = useDownloadStore((s) => s.settings.language) || DEFAULT_LANGUAGE;
  return useMemo(
    () => ({
      language,
      t: (key, vars) => translate(language, key, vars),
      tn: (key, count, vars) => translatePlural(language, key, count, vars),
    }),
    [language]
  );
}
