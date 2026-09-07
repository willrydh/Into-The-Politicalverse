import assert from "node:assert/strict";
import test from "node:test";
import { splitPartyText, partyDisplayName } from "../lib/party-labels";
import { translateText } from "../lib/i18n/translate";

test("political copy recognizes whole party tokens without changing figures, words or punctuation", () => {
  const text = "Når S, V, MP och C minst 175 mandat? SD–M: +2,5 %. KD/L, FP 2014. SCB, MODEL, Malmö, SÄPO, MP2026.";
  const parts = splitPartyText(text);
  assert.equal(parts.map(p => p.text).join(""), text);
  assert.deepEqual(parts.filter(p => p.partyId).map(p => p.partyId), ["S", "V", "MP", "C", "SD", "M", "KD", "L", "L"]);
  assert.equal(parts.find(p => p.text === "FP")?.historical, true);
  assert.deepEqual(splitPartyText("Övriga partier och Borås lokala parti"), [{ text: "Övriga partier och Borås lokala parti" }]);
});

test("complete forecast sentences translate before party abbreviations are annotated", () => {
  const original = "Når S, V, MP och C minst 175 mandat?";
  const translated = translateText(original, "en");
  assert.notEqual(translated, original);
  const parts = splitPartyText(translated);
  assert.deepEqual(parts.filter(p => p.partyId).map(p => p.partyId), ["S", "V", "MP", "C"]);
  assert.match(parts.filter(p => !p.partyId).map(p => p.text).join(""), /175/);
  assert.doesNotMatch(parts.map(p => p.text).join(""), /Når|och|minst|mandat/);
  assert.equal(translateText(partyDisplayName("L", 2014), "en"), "Liberal People’s Party");
  assert.equal(translateText(partyDisplayName("L", 2018), "en"), "Liberals");
});
