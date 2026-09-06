import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { translateText, localizedHref, ROUTES } from "../lib/i18n/translate";
import { localizeNode } from "../lib/i18n/react";

test("both languages translate dynamic explanations, accessible labels and dates without changing figures", () => {
  assert.equal(translateText("HUVUDSIGNAL · MODEL", "sv"), "HUVUDSIGNAL · MODELL");
  assert.equal(translateText("Senaste mätningen publicerades för 12 dagar sedan.", "en"), "The latest poll was published 12 days ago.");
  assert.equal(translateText("Socialdemokraterna: 80-procentigt mandatintervall 100 till 117", "en"), "Social Democrats: 80% seat interval from 100 to 117");
  assert.equal(translateText("Socialdemokraterna vote share slider", "sv"), "Socialdemokraterna röstandelsreglage");
  assert.equal(translateText("Socialdemokraterna vote share slider", "en"), "Social Democrats vote share slider");
  assert.equal(translateText("6 sep. 2026 15:08", "en"), "6 Sept 2026 15:08");
  assert.equal(translateText("11 Sept", "sv"), "11 sep.");
  assert.equal(translateText("1,779,415", "sv"), "1\u00a0779\u00a0415");
  assert.equal(translateText("95,7 %", "en"), "95.7 %");
  assert.equal(translateText("349", "sv"), "349");
  assert.equal(translateText("1.0.0-beta.1", "sv"), "1.0.0-beta.1");
  assert.equal(translateText("Borås", "en"), "Borås");
});

test("language routes preserve the current page, fragment and asset or API destinations", () => {
  for (const route of ROUTES) {
    const path = `/${route}${route ? "/" : ""}`;
    assert.equal(localizedHref(path, "en"), `/en${path}`);
    assert.equal(localizedHref(`/en${path}`, "sv"), path);
  }
  assert.equal(localizedHref("/forecasts/#metod", "en"), "/en/forecasts/#metod");
  for (const path of ["/api/forecasts/2026.json", "/parties/s.svg", "https://www.val.se/", "#fragor"]) assert.equal(localizedHref(path, "en"), path);
});

test("server output localizes before serialization and preserves controls and machine values", () => {
  const tree = createElement("div", null,
    createElement("a", { href: "/valnatt" }, "Valnatt"),
    createElement("input", { value: "12.50", readOnly: true, "aria-label": "Socialdemokraterna vote share" }),
    createElement("code", null, "MODEL"));
  const html = renderToStaticMarkup(localizeNode(tree, "en"));
  assert.match(html, /href="\/en\/valnatt"/); assert.match(html, />Election night</);
  assert.match(html, /value="12\.50"/); assert.match(html, /aria-label="Social Democrats vote share"/);
  assert.match(html, /<code>MODEL<\/code>/);
});
