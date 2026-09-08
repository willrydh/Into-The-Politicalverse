import { personShard } from "../../../lib/candidates/types";
import { SHARE_DESIGN, SHARE_SCHEMA, selectShareScope, shareDescription, shareTitle, validateSharePerson, type ShareLocale, type SharePerson, type ShareScope } from "../../../lib/candidates/sharing";
import { renderCard } from "./card";

const TTL = 60;
const ID = /^p\d{4}-\d{1,12}$/;
const MAX_SHARD_BYTES = 4 * 1024 * 1024;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function boundedJSON(response: Response): Promise<unknown> {
  if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json") || !response.body) throw new Error("Sharing source unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SHARD_BYTES) { await reader.cancel(); throw new Error("Sharing source too large"); }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(text + decoder.decode());
}

async function loadPerson(id: string, origin: string) {
  // A bounded minute bucket also avoids GitHub Pages' longer upstream asset TTL.
  // No browser cookies, authorization headers or arbitrary URLs reach the data source.
  const url = `${origin}/api/candidates/sharing-v1/${personShard(id)}.json?fresh=${Math.floor(Date.now() / (TTL * 1000))}`;
  const payload = await boundedJSON(await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), cf: { cacheEverything: true, cacheTtl: TTL } }));
  if (!payload || typeof payload !== "object") throw new Error("Invalid sharing envelope");
  const data = payload as { schemaVersion?: number; sourceVersion?: string; people?: Record<string, unknown> };
  if (data.schemaVersion !== SHARE_SCHEMA || !/^[a-f0-9]{64}$/.test(data.sourceVersion ?? "") || !data.people || typeof data.people !== "object") throw new Error("Invalid sharing envelope");
  const person = Object.hasOwn(data.people, id) ? data.people[id] : undefined;
  if (!person) return null;
  validateSharePerson(person, id);
  return { person, sourceVersion: data.sourceVersion! };
}

function profileURL(origin: string, person: SharePerson, scope: ShareScope, locale: ShareLocale) {
  return `${origin}${locale === "en" ? "/en" : ""}/people/?${new URLSearchParams({ person: person.id, election: scope.election, area: scope.area })}`;
}
function imageURL(origin: string, person: SharePerson, scope: ShareScope, locale: ShareLocale) {
  return `${origin}/share/candidate/${person.id}.png?${new URLSearchParams({ election: scope.election, area: scope.area, lang: locale, v: `${person.revision}-${SHARE_DESIGN}` })}`;
}

function metadata(origin: string, person: SharePerson, scope: ShareScope, locale: ShareLocale) {
  const title = shareTitle(person, scope), description = shareDescription(person, scope, locale);
  const url = profileURL(origin, person, scope, locale), image = imageURL(origin, person, scope, locale);
  const meta = (key: string, value: string, attr = "property") => `<meta ${attr}="${key}" content="${escape(value)}">`;
  return `<title>${escape(title)}</title>` + meta("description", description, "name") +
    `<link rel="canonical" href="${escape(url)}">` +
    (["sv", "en", "x-default"] as const).map(lang => `<link rel="alternate" hreflang="${lang}" href="${escape(profileURL(origin, person, scope, lang === "en" ? "en" : "sv"))}">`).join("") +
    [["og:type", "profile"], ["og:site_name", "Into the Politicalverse"], ["og:title", title], ["og:description", description], ["og:url", url], ["og:locale", locale === "sv" ? "sv_SE" : "en_GB"], ["og:image", image], ["og:image:secure_url", image], ["og:image:type", "image/png"], ["og:image:width", "1200"], ["og:image:height", "630"], ["og:image:alt", description]].map(([key, value]) => meta(key, value)).join("") +
    [["twitter:card", "summary_large_image"], ["twitter:title", title], ["twitter:description", description], ["twitter:image", image], ["twitter:image:alt", description]].map(([key, value]) => meta(key, value, "name")).join("");
}

function fail(status: number) {
  return new Response(status === 404 ? "Candidate not found" : "Sharing image temporarily unavailable", { status, headers: { "Cache-Control": "no-store", "Retry-After": String(TTL), "X-Content-Type-Options": "nosniff" } });
}

async function imageResponse(request: Request, env: Env, ctx: ExecutionContext, id: string) {
  const url = new URL(request.url);
  const loaded = await loadPerson(id, env.SITE_ORIGIN);
  if (!loaded) return fail(404);
  const { person, sourceVersion } = loaded;
  const scope = selectShareScope(person, url.searchParams), locale = url.searchParams.get("lang") === "en" ? "en" : "sv";
  const canonical = imageURL(env.SITE_ORIGIN, person, scope, locale);
  if (url.href !== canonical) return new Response(null, { status: 302, headers: { Location: canonical, "Cache-Control": "no-store" } });
  // Resolve current data BEFORE looking in the image cache: even an old image link
  // redirects to the current revision after an accepted new election/correction.
  const key = new Request(canonical);
  const cached = await caches.default.match(key);
  const headers = new Headers({ "Content-Type": "image/png", "Cache-Control": "public, max-age=300, must-revalidate", "X-Content-Type-Options": "nosniff", "X-PV-Source-Version": sourceVersion, "X-PV-Card-Revision": person.revision,
    ETag: `"${person.revision}-${SHARE_DESIGN}-${scope.election}-${scope.area}-${locale}"` });
  if (request.headers.get("If-None-Match") === headers.get("ETag")) return new Response(null, { status: 304, headers });
  if (request.method === "HEAD") return new Response(null, { headers });
  if (cached) return new Response(cached.body, { headers });
  const png = await renderCard(person, scope, locale);
  const bytes = new Uint8Array(png).buffer;
  const response = new Response(bytes, { headers });
  const cachedHeaders = new Headers(headers); cachedHeaders.set("Cache-Control", "public, max-age=86400");
  ctx.waitUntil(caches.default.put(key, new Response(bytes, { headers: cachedHeaders })).catch(() => { console.error("candidate_image_cache_write_failed"); }));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.origin !== env.SITE_ORIGIN) return new Response("Wrong origin", { status: 421 });
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    const image = /^\/share\/candidate\/(p\d{4}-\d{1,12})\.png$/.exec(url.pathname);
    if (url.pathname.startsWith("/share/candidate/")) {
      if (!image) return fail(404);
      try { return await imageResponse(request, env, ctx, image[1]); }
      catch { console.error("candidate_image_unavailable"); return fail(503); }
    }
    const profile = /^\/(en\/)?people\/?$/.exec(url.pathname);
    // Next's static RSC requests, assets and unrelated routes pass through untouched.
    if (!profile || request.headers.get("RSC") === "1") return fetch(request);
    const id = url.searchParams.get("person") ?? "";
    if (!ID.test(id)) return fetch(request);
    if (!url.pathname.endsWith("/")) {
      url.pathname += "/";
      return new Response(null, { status: 308, headers: { Location: url.href } });
    }
    // Routes' same-host fetch goes to the configured Pages origin, not this Worker.
    const upstream = await fetch(`${env.SITE_ORIGIN}${url.pathname}`, { redirect: "manual", signal: AbortSignal.timeout(10000) });
    if (!upstream.ok || !upstream.headers.get("Content-Type")?.includes("text/html")) return upstream;
    const headers = new Headers(upstream.headers);
    for (const name of ["ETag", "Last-Modified", "Content-Length", "Content-MD5"]) headers.delete(name);
    headers.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
    try {
      const loaded = await loadPerson(id, env.SITE_ORIGIN);
      if (!loaded) { headers.set("Cache-Control", "no-store"); return new Response(request.method === "HEAD" ? null : upstream.body, { headers }); }
      const { person, sourceVersion } = loaded, locale = profile[1] ? "en" : "sv";
      const scope = selectShareScope(person, url.searchParams);
      headers.set("X-PV-Source-Version", sourceVersion);
      headers.set("X-PV-Card-Revision", person.revision);
      if (request.method === "HEAD") return new Response(null, { headers });
      return new HTMLRewriter()
        .on('title, meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], link[rel="alternate"][hreflang]', { element(e) { e.remove(); } })
        .on("head", { element(e) { e.append(metadata(env.SITE_ORIGIN, person, scope, locale), { html: true }); } })
        .transform(new Response(upstream.body, { headers }));
    } catch {
      // A sharing dependency failure must not break the existing public profile.
      console.error("candidate_metadata_unavailable");
      headers.set("Cache-Control", "no-store");
      return new Response(request.method === "HEAD" ? null : upstream.body, { headers });
    }
  },
} satisfies ExportedHandler<Env>;
