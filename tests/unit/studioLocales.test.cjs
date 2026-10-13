const test = require("node:test");
const assert = require("node:assert/strict");

test("studio translations cover every key in all seven languages", async () => {
  const { default: locales } = await import("../../src/renderer/src/i18n/studio.js");
  const keys = Object.keys(locales.en).sort();
  assert.equal(Object.keys(locales).length, 7);
  for (const [language, dictionary] of Object.entries(locales)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, language);
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, "string", `${language}.${key}`);
      assert.ok(value.trim().length > 0, `${language}.${key}`);
      assert.ok(!/[?\uFFFD]/u.test(value), `${language}.${key}: encoding damage`);
    }
  }
});

test("studio translations preserve accented and non-Latin characters", async () => {
  const { default: locales } = await import("../../src/renderer/src/i18n/studio.js");
  assert.match(locales["pt-BR"].hero, /vídeos e músicas/u);
  assert.equal(locales["pt-BR"].ready, "Análise concluída");
  assert.equal(locales.de.close, "Schließen");
  assert.equal(locales.es.step1, "Añade un enlace");
  assert.match(locales.ja.hero, /[\u3040-\u30ff]/u);
  assert.match(locales.zh.hero, /[\u4e00-\u9fff]/u);
  assert.match(locales.ru.hero, /[\u0400-\u04ff]/u);
});
