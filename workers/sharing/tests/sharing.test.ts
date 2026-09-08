import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { execFileSync } from "node:child_process";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { buildSharePerson } from "../../../lib/candidates/build-sharing";
import { getCandidateData } from "../../../lib/candidates/build";

const origin = "https://politicalverse.se", build = resolve(".wrangler/sharing-test-bundle");
rmSync(build, { recursive: true, force: true });
execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "deploy", "--dry-run", "--config", "workers/sharing/wrangler.jsonc", "--outdir", build], { stdio: "pipe", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
const source = getCandidateData();
const jonas = source.people.find(p => p.id === "p2014-497303")!;
const initial = buildSharePerson(jonas);
const html = '<!doctype html><html><head><title>Generic</title><meta name="description" content="Generic"><meta property="og:image" content="generic.png"><meta name="twitter:image" content="generic.png"><link rel="canonical" href="https://politicalverse.se/people/"><link rel="alternate" hreflang="en" href="https://politicalverse.se/en/people/"><meta name="viewport" content="width=device-width"></head><body><main id="profile">Existing page</main><script src="/application.js"></script></body></html>';
const imageURL = (text: string) => text.match(/property="og:image" content="([^"]+)"/)![1].replaceAll("&amp;", "&");

test("public candidate metadata, real PNGs and election updates at the Worker boundary", async t => {
  let current = initial, sourceFailure = false, oversized = false;
  const outbound: string[] = [];
  const mf = new Miniflare(convertV4MiniflareOptions({ host: "127.0.0.1", port: 4317, modulesRoot: build,
    modules: ["index.js", ...readdirSync(build).filter(f => /\.(svg|woff|wasm)$/.test(f))].map(file => ({ type: file === "index.js" ? "ESModule" : file.endsWith(".wasm") ? "CompiledWasm" : file.endsWith(".woff") ? "Data" : "Text", path: resolve(build, file) })),
    compatibilityDate: "2026-09-08", compatibilityFlags: ["nodejs_compat"], bindings: { SITE_ORIGIN: origin },
    outboundService: request => {
      outbound.push(request.url);
      assert.equal(request.headers.get("Cookie"), null);
      if (new URL(request.url).pathname.startsWith("/api/candidates/sharing-v1/")) return sourceFailure ? new Response("down", { status: 503 }) : new Response(oversized ? "x".repeat(4 * 1024 * 1024 + 1) : JSON.stringify({ schemaVersion: 1, sourceVersion: source.catalog.version, people: { [current.id]: current } }), { headers: { "Content-Type": "application/json" } });
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ETag: "generic", "Last-Modified": "yesterday" } });
    },
  }));
  t.after(() => mf.dispose());
  const request = (path: string, init = {}) => mf.dispatchFetch(path.startsWith("https:") ? path : origin + path, { redirect: "manual", ...init });
  const profile = "/people/?person=p2014-497303&election=KF&area=1480";
  let firstImage = "";
  await t.test("raw HTML has exactly one candidate-specific OG/Twitter set without changing page body", async () => {
    const r = await request(profile, { headers: { Cookie: "private=secret" } });
    assert.equal(r.status, 200); assert.equal(r.headers.get("ETag"), null);
    const body = await r.text();
    assert.match(body, /Jonas Attenius \(S\)/); assert.match(body, /3 720 personröster/); assert.match(body, /\+582,6 % sedan 2018/);
    assert.match(body, /Kommunfullmäktige · Göteborg · 2022/);
    assert.equal((body.match(/property="og:image"/g) ?? []).length, 1);
    assert.equal((body.match(/name="twitter:image"/g) ?? []).length, 1);
    assert.equal((body.match(/<title(?:\s|>)/g) ?? []).length, 1);
    assert.equal(body.split("<body>")[1], html.split("<body>")[1]);
    assert.match(body, /width=device-width/); assert.match(body, /rel="canonical" href="https:\/\/politicalverse.se\/people\/\?person=/);
    // Execute the real parse-time handoff with a minimal head adapter. React must
    // receive its original title/canonical and no extra edge-owned DOM nodes.
    const bootstrap = body.match(/<script data-pv-sharing-bootstrap>([\s\S]*?)<\/script>/)![1];
    let removed = 0, restored = "";
    runInNewContext(bootstrap, { document: { head: {
      querySelectorAll(selector: string) { assert.equal(selector, "[data-pv-sharing]"); return [{ remove() { removed++; } }]; },
      insertAdjacentHTML(position: string, value: string) { assert.equal(position, "beforeend"); restored = value; },
    } } });
    assert.equal(removed, 1);
    assert.match(restored, /<title>Generic<\/title>/);
    assert.match(restored, /property="og:image" content="generic.png"/);
    assert.match(restored, /rel="canonical" href="https:\/\/politicalverse.se\/people\/"/);
    assert.ok(!restored.includes("Jonas"));
    firstImage = imageURL(body);
    assert.match(firstImage, /election=KF&area=1480&lang=sv&v=/);
  });
  await t.test("real image decoding, cache hits, HEAD and conditional requests", async () => {
    const r = await request(firstImage); assert.equal(r.status, 200, await r.clone().text()); assert.equal(r.headers.get("Content-Type"), "image/png");
    const png = Buffer.from(await r.arrayBuffer()); assert.equal(png.subarray(1, 4).toString(), "PNG"); assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
    writeFileSync(resolve(build, "jonas-attenius.png"), png);
    assert.deepEqual(Buffer.from(await (await request(firstImage)).arrayBuffer()), png);
    const head = await request(firstImage, { method: "HEAD" }); assert.equal(head.status, 200); assert.equal(await head.text(), "");
    assert.equal((await request(firstImage, { headers: { "If-None-Match": r.headers.get("ETag")! } })).status, 304);
  });
  await t.test("English and different scopes have distinct images and canonical links", async () => {
    const body = await (await request("/en" + profile)).text();
    assert.match(body, /3,720 personal votes/); assert.match(body, /\+582.6 % since 2018/); assert.match(body, /Municipal council/);
    const image = imageURL(body); assert.notEqual(image, firstImage); assert.match(image, /lang=en/);
    const png = await request(image); assert.equal(png.status, 200);
    writeFileSync(resolve(build, "jonas-en.png"), Buffer.from(await png.arrayBuffer()));
  });
  await t.test("real negative, missing, party-switch and long-name cards all render", async () => {
    for (const [id, election, area, file] of [
      ["p2014-430402", "KF", "1490", "lars-negative"],
      ["p2014-430402", "RD", "19", "lars-party-switch"],
      ["p2022-29046", "RD", "19", "jan-missing"],
      ["p2010-511461", "RD", "01", "long-party-name"],
    ]) {
      current = buildSharePerson(source.people.find(p => p.id === id)!);
      const body = await (await request(`/people/?person=${id}&election=${election}&area=${area}`)).text();
      const image = await request(imageURL(body)); assert.equal(image.status, 200);
      writeFileSync(resolve(build, `${file}.png`), Buffer.from(await image.arrayBuffer()));
      if (file === "lars-negative") assert.match(body, /−36,3 % sedan 2018/);
      if (file === "lars-party-switch") assert.match(body, /\+137,2 % sedan 2018/);
      if (file === "jan-missing") assert.match(body, /Tidigare jämförbart resultat saknas/);
    }
    current = initial;
  });
  await t.test("new verified election and count correction invalidate metadata AND an already-cached image", async () => {
    // Synthetic future data never leaves the test process or the test bundle.
    const p = structuredClone(jonas);
    const latest = p.results.find(r => r.year === 2022 && r.electionType === "KF" && r.areaCode === "1480" && r.level === "municipality")!;
    p.results.push({ ...latest, year: 2026 as typeof latest.year, votes: 7440 });
    current = buildSharePerson(p);
    const body = await (await request(profile)).text();
    assert.match(body, /Göteborg · 2026/); assert.match(body, /7 440 personröster/); assert.match(body, /\+100 % sedan 2022/);
    const fresh = imageURL(body); assert.notEqual(fresh, firstImage);
    const old = await request(firstImage); assert.equal(old.status, 302); assert.equal(old.headers.get("Location"), fresh); assert.equal(old.headers.get("Cache-Control"), "no-store");
    assert.equal((await request(firstImage, { headers: { "If-None-Match": `"${initial.revision}"` } })).status, 302);
    assert.equal((await request(fresh)).status, 200);
    p.results.at(-1)!.votes = 7441; current = buildSharePerson(p);
    assert.notEqual(imageURL(await (await request(profile)).text()), fresh);
    current = initial;
  });
  await t.test("all text is escaped; request parameters cannot inject image content or upstream URLs", async () => {
    current = { ...initial, name: '<script>alert("name")</script> & Åsa' };
    const body = await (await request(profile + "&name=FAKE&image=https://evil.example/")).text();
    assert.ok(!body.includes('<script>alert("name")</script>')); assert.match(body, /&lt;script&gt;/); assert.ok(!body.includes("FAKE"));
    assert.ok(outbound.every(url => url.startsWith(origin + "/")));
    current = initial;
  });
  await t.test("missing data fails safely, dependencies cannot take down the profile", async () => {
    assert.equal((await request("/share/candidate/p2022-999999999.png")).status, 404);
    sourceFailure = true;
    assert.equal(await (await request(profile)).text(), html);
    const r = await request(firstImage); assert.equal(r.status, 503); assert.equal(r.headers.get("Cache-Control"), "no-store");
    sourceFailure = false; oversized = true;
    assert.equal((await request(firstImage)).status, 503); oversized = false;
  });
  await t.test("generic profiles, RSC and other pages retain their existing responses", async () => {
    for (const path of ["/people/", "/people/?person=invalid", "/people/index.txt", "/rankings/"]) assert.equal(await (await request(path)).text(), html);
    assert.equal(await (await request(profile, { headers: { RSC: "1" } })).text(), html);
    assert.equal((await request("https://other.example" + profile)).status, 421);
    assert.equal((await request(profile, { method: "POST" })).status, 405);
    assert.equal((await request("/share/candidate/invalid.png")).status, 404);
  });
});
