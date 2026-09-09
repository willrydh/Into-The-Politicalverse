import assert from "node:assert/strict";
import { test } from "node:test";
import { DOMAIN, checkDomain, runHealthCheck, validateAddresses, validateDns, validatePage, validateRedirect } from "../scripts/check-domain-health.mjs";

function dns(name = DOMAIN, type = 1, values = ["104.21.34.177"]) {
  return { Status: 0, AD: true, CD: false, TC: false, Question: [{ name: `${name}.`, type }], Answer: values.map((data) => ({ name: `${name}.`, type, TTL: 300, data })) };
}
function response(text, status = 200, headers = {}) {
  return { text, status, headers: new Headers({ "content-type": "text/html; charset=utf-8", ...headers }) };
}
function page(path = "/") {
  return response(`<title>Politicalverse</title><link rel="canonical" href="https://${DOMAIN}${path}"><link href="${path.startsWith("/en/") ? "/en" : ""}/manifest.webmanifest" rel="manifest">`);
}
async function healthyGet(input) {
  const url = new URL(input);
  if (url.hostname === "dns.google" || url.hostname === "cloudflare-dns.com") {
    const name = url.searchParams.get("name");
    const type = url.searchParams.get("type");
    assert.equal(url.searchParams.get("cd"), "false");
    assert.equal(url.searchParams.get("do"), "true");
    const values = type === "NS" ? ["KURT.NS.CLOUDFLARE.COM.", "cheryl.ns.cloudflare.com."] : type === "AAAA" ? ["2606:4700:3034::6815:22b1"] : ["104.21.34.177"];
    return response(JSON.stringify(dns(name, { A: 1, NS: 2, AAAA: 28 }[type], values)));
  }
  if (url.protocol === "http:" || url.hostname === `www.${DOMAIN}`) {
    return response("", 301, { location: `https://${DOMAIN}${url.pathname}${url.search}` });
  }
  if (url.pathname === "/manifest.webmanifest") {
    return response(JSON.stringify({ short_name: "Politicalverse", start_url: "/", scope: "/", icons: [{ src: "/brand/icon.png" }] }));
  }
  return page(url.pathname);
}
const healthyResolve = async () => [{ address: "104.21.34.177", family: 4 }];

test("domain check accepts validated current DNS, both languages, content and exact redirects", async () => {
  const result = await checkDomain({ get: healthyGet, resolve: healthyResolve });
  assert.equal(result.healthy, true);
  assert.equal(result.checks.length, 18);
  assert.ok(result.checks.every((check) => check.ok));
  // Proxy addresses may rotate without an operational/configuration change.
  assert.equal(validateAddresses(["172.67.163.143"], 4), "172.67.163.143");
});

test("old Loopia delegation, mixed parking addresses and missing IPv6 fail closed", () => {
  assert.throws(() => validateDns(dns(DOMAIN, 2, ["ns1.loopia.se.", "ns2.loopia.se."]), DOMAIN, "NS"), /Unexpected nameservers/);
  assert.throws(() => validateDns(dns(DOMAIN, 1, ["104.21.34.177", "194.9.94.86"]), DOMAIN, "A"), /Loopia/);
  assert.throws(() => validateDns(dns(DOMAIN, 28, []), DOMAIN, "AAAA"), /missing/);
});

test("unsigned, bogus, disabled, truncated, malformed or unrelated DNS responses cannot pass", () => {
  for (const patch of [{ AD: false }, { CD: true }, { TC: true }, { Status: 2 }, { Answer: null }, { Question: [] }]) {
    assert.throws(() => validateDns({ ...dns(), ...patch }, DOMAIN, "A"));
  }
  assert.throws(() => validateDns(dns("example.com"), DOMAIN, "A"), /question mismatch/);
  assert.throws(() => validateDns(dns(DOMAIN, 1, ["not an IP"]), DOMAIN, "A"), /Invalid address/);
});

test("HTTP 200 parking and wrong-site HTML are failures, not a successful uptime check", () => {
  assert.throws(() => validatePage(response("<title>Parked at Loopia</title>politicalverse.se"), "/"), /parking/);
  assert.throws(() => validatePage(response("<title>Politicalverse</title>"), "/"), /Canonical/);
  assert.throws(() => validatePage(page("/"), "/en/"), /Canonical/);
  assert.throws(() => validatePage(response(page().text, 503), "/"), /503/);
});

test("redirects must permanently preserve path, query and HTTPS canonical host", () => {
  const target = `https://${DOMAIN}/rankings/?county=14&metric=votes`;
  for (const location of [`http://${DOMAIN}/rankings/?county=14&metric=votes`, `https://${DOMAIN}/`, "https://loopia.se/"]) {
    assert.throws(() => validateRedirect(response("", 301, { location }), target));
  }
  assert.throws(() => validateRedirect(response("", 302, { location: target }), target));
  assert.equal(validateRedirect(response("", 308, { location: target }), target).location, target);
});

test("system resolver parking remains a failure even if both public resolvers are healthy", async () => {
  const result = await checkDomain({ get: healthyGet, resolve: async () => [{ address: "194.9.94.85", family: 4 }] });
  assert.equal(result.healthy, false);
  assert.equal(result.checks.filter((check) => !check.ok).length, 2);
  assert.ok(result.checks.filter((check) => !check.ok).every((check) => check.name.startsWith("System DNS")));
});

test("resolver outage and certificate/network errors are diagnosed separately without skipping other checks", async () => {
  const result = await checkDomain({ resolve: healthyResolve, get: async (url) => {
    if (url.startsWith("https://dns.google/")) throw new Error("Resolver timed out");
    if (url === `https://${DOMAIN}/`) throw new Error("Certificate expired");
    return healthyGet(url);
  } });
  assert.equal(result.healthy, false);
  assert.equal(result.checks.length, 18);
  assert.equal(result.checks.filter((check) => !check.ok).length, 6);
  assert.ok(result.checks.some((check) => check.ok && check.name === "HTTPS /en/"));
});

test("brief failure gets a bounded retry; persistent fault still alerts with all evidence retained", async () => {
  let calls = 0;
  const waits = [];
  const recovered = await runHealthCheck({ check: async () => ({ healthy: ++calls === 2, checks: [] }), wait: async (ms) => { waits.push(ms); } });
  assert.equal(recovered.healthy, true);
  assert.equal(recovered.attempts.length, 2);
  assert.deepEqual(waits, [20_000]);
  const failed = await runHealthCheck({ check: async () => ({ healthy: false, checks: [] }), wait: async () => {} });
  assert.equal(failed.healthy, false);
  assert.equal(failed.attempts.length, 3);
  assert.equal((await runHealthCheck({ check: async () => ({ healthy: true, checks: [] }) })).attempts.length, 1);
});
