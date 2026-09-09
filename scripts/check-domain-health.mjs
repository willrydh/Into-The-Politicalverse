import { lookup } from "node:dns/promises";
import { writeFile, appendFile } from "node:fs/promises";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

export const DOMAIN = "politicalverse.se";
const ORIGIN = `https://${DOMAIN}`;
const NAMESERVERS = ["cheryl.ns.cloudflare.com", "kurt.ns.cloudflare.com"];
const PARKING_IPS = new Set(["194.9.94.85", "194.9.94.86"]);
const PROVIDERS = [
  ["Cloudflare", "https://cloudflare-dns.com/dns-query"],
  ["Google", "https://dns.google/resolve"],
];
const TYPES = { A: 1, NS: 2, AAAA: 28 };
const normalizeName = (name) => typeof name === "string" ? name.toLowerCase().replace(/\.$/, "") : "";

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

// No forced address, TLS bypass, cookies, credentials or automatic redirects.
export async function request(url, accept = "text/html") {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
    headers: { accept, "user-agent": "Politicalverse-Domain-Health/1.0", "cache-control": "no-cache" },
  });
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  if (response.body) {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      requireCondition(bytes <= 2_000_000, "Response exceeds the 2 MB health-check limit");
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  }
  return { status: response.status, headers: response.headers, text };
}

export function validateAddresses(addresses, family) {
  requireCondition(Array.isArray(addresses) && addresses.length > 0, "No address records");
  requireCondition(addresses.every((address) => isIP(address) === family), "Invalid address record");
  requireCondition(addresses.every((address) => !PARKING_IPS.has(address)), "Loopia parking address returned");
  return addresses.join(", ");
}

export function validateDns(payload, name, type) {
  requireCondition(payload?.Status === 0, `DNS response failed (status ${payload?.Status ?? "missing"})`);
  requireCondition(payload.AD === true && payload.CD === false && payload.TC === false, "DNSSEC validation missing, disabled or response truncated");
  requireCondition(payload.Question?.length === 1 && normalizeName(payload.Question[0].name) === name && payload.Question[0].type === TYPES[type], "DNS response question mismatch");
  requireCondition(Array.isArray(payload.Answer), "DNS answers missing");
  const records = payload.Answer.filter((row) => row.type === TYPES[type] && normalizeName(row.name) === name);
  requireCondition(records.length > 0 && records.every((row) => typeof row.data === "string" && Number.isInteger(row.TTL) && row.TTL >= 0), "DNS records missing or malformed");
  const values = records.map((row) => row.data);
  if (type === "NS") {
    requireCondition(JSON.stringify(values.map(normalizeName).sort()) === JSON.stringify(NAMESERVERS), `Unexpected nameservers: ${values.join(", ")}`);
  } else {
    validateAddresses(values, type === "A" ? 4 : 6);
  }
  return { values, ttl: records.map((row) => row.TTL), dnssec: true };
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}

export function validatePage(response, path) {
  requireCondition(response.status === 200, `Expected HTTP 200, received ${response.status}`);
  requireCondition(response.headers.get("content-type")?.includes("text/html"), "Expected HTML content");
  const title = response.text.match(/<title\b[^>]*>([^<]+)<\/title>/i)?.[1];
  requireCondition(title && /Politicalverse/i.test(title) && !/Loopia|parked|parkerad/i.test(title), "Politicalverse page title missing or parking page returned");
  const links = response.text.match(/<link\b[^>]*>/gi) ?? [];
  const canonical = links.find((tag) => attribute(tag, "rel") === "canonical");
  requireCondition(canonical && attribute(canonical, "href") === `${ORIGIN}${path}`, "Canonical URL missing or incorrect");
  requireCondition(links.some((tag) => attribute(tag, "rel") === "manifest" && attribute(tag, "href") === `${path.startsWith("/en/") ? "/en" : ""}/manifest.webmanifest`), "Politicalverse app manifest link missing");
  return { status: response.status, title, canonical: `${ORIGIN}${path}` };
}

export function validateRedirect(response, expected) {
  requireCondition([301, 308].includes(response.status), `Expected permanent redirect, received ${response.status}`);
  requireCondition(response.headers.get("location") === expected, "Redirect changed the host, protocol, path or query");
  return { status: response.status, location: expected };
}

export function validateManifest(response) {
  requireCondition(response.status === 200, `Manifest returned HTTP ${response.status}`);
  const manifest = JSON.parse(response.text);
  requireCondition(manifest.short_name === "Politicalverse" && manifest.start_url === "/" && manifest.scope === "/", "Politicalverse manifest identity or base path is incorrect");
  requireCondition(Array.isArray(manifest.icons) && manifest.icons.some((icon) => typeof icon.src === "string" && icon.src.startsWith("/brand/")), "Politicalverse app icons missing");
  return { status: response.status, name: manifest.short_name };
}

export async function checkDomain({ get = request, resolve = lookup } = {}) {
  const checks = [];
  const add = (name, run) => checks.push({ name, run });
  for (const [provider, endpoint] of PROVIDERS) {
    for (const [name, type] of [[DOMAIN, "NS"], [DOMAIN, "A"], [DOMAIN, "AAAA"], [`www.${DOMAIN}`, "A"], [`www.${DOMAIN}`, "AAAA"]]) {
      add(`${provider} DNSSEC ${name} ${type}`, async () => {
        const url = new URL(endpoint);
        url.search = new URLSearchParams({ name, type, do: "true", cd: "false" }).toString();
        const response = await get(url.href, "application/dns-json");
        requireCondition(response.status === 200, `Resolver returned HTTP ${response.status}`);
        return validateDns(JSON.parse(response.text), name, type);
      });
    }
  }
  for (const name of [DOMAIN, `www.${DOMAIN}`]) {
    add(`System DNS ${name}`, async () => {
      const controller = new AbortController();
      try {
        const addresses = await Promise.race([
          resolve(name, { all: true }),
          delay(12_000, null, { signal: controller.signal }).then(() => { throw new Error("System DNS lookup timed out"); }),
        ]);
        requireCondition(addresses.length > 0, "System DNS returned no addresses");
        for (const { address, family } of addresses) {
          requireCondition([4, 6].includes(family), "Unknown address family");
          validateAddresses([address], family);
        }
        return addresses;
      } finally {
        controller.abort();
      }
    });
  }
  for (const path of ["/", "/en/", "/rankings/"]) {
    add(`HTTPS ${path}`, async () => validatePage(await get(`${ORIGIN}${path}`), path));
  }
  add("PWA manifest", async () => validateManifest(await get(`${ORIGIN}/manifest.webmanifest`, "application/manifest+json")));
  const selection = "/rankings/?county=14&metric=votes";
  for (const origin of [`http://${DOMAIN}`, `https://www.${DOMAIN}`]) {
    add(`Redirect ${origin}`, async () => validateRedirect(await get(`${origin}${selection}`), `${ORIGIN}${selection}`));
  }
  const results = await Promise.all(checks.map(async ({ name, run }) => {
    try {
      return { name, ok: true, detail: await run() };
    } catch (error) {
      return { name, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }));
  return { checkedAt: new Date().toISOString(), healthy: results.every((result) => result.ok), checks: results };
}

export async function runHealthCheck({ check = checkDomain, wait = delay, attempts = 3 } = {}) {
  requireCondition(Number.isInteger(attempts) && attempts >= 1 && attempts <= 3, "Health checks allow one to three attempts");
  const history = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await wait(20_000);
    const result = await check();
    history.push(result);
    if (result.healthy) break;
  }
  return { domain: DOMAIN, healthy: history.at(-1).healthy, attempts: history };
}

async function main() {
  const { values } = parseArgs({ options: { once: { type: "boolean" }, report: { type: "string", default: "domain-health.json" } } });
  const report = await runHealthCheck({ attempts: values.once ? 1 : 3 });
  await writeFile(values.report, `${JSON.stringify(report, null, 2)}\n`);
  const latest = report.attempts.at(-1);
  const lines = latest.checks.map((check) => `${check.ok ? "PASS" : "FAIL"} ${check.name}${check.ok ? "" : `: ${check.error}`}`);
  console.log(`${latest.checkedAt}\n${lines.join("\n")}\nAttempts: ${report.attempts.length}. Healthy: ${report.healthy}. Report: ${values.report}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = `## politicalverse.se: ${report.healthy ? "healthy" : "check failed"}\n\nChecked ${latest.checkedAt}; ${report.attempts.length} attempt(s). Full DNS values and earlier failures are in the domain-health artifact.\n\n\`\`\`text\n${lines.join("\n")}\n\`\`\`\n\nRead [the domain health runbook](https://github.com/willrydh/Into-The-Politicalverse/blob/main/docs/operations/domain-health.md).\n`;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  if (!report.healthy) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
