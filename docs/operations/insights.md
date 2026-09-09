# Politicalverse Insikter

Release, 9 September 2026: the Worker and EU database are deployed on the HTTPS domain. This release connects the browser collector to both language layouts and the global 404, with explicit consent and bilingual privacy/preferences. The owner has approved the displayed privacy contact. The Google account/stream is still unconnected; no Google tag is included, and the first-party consent does not authorize adding Google later without renewed disclosure and choice.

Investigation before activation: production D1 and authenticated report/realtime APIs both returned zero visits and zero events. The previous static release contained no browser collector. Historical visits cannot be reconstructed from these tables. Worker version `44a9c9b5-dc63-4bc0-bfff-83c0ba51ea50` reports the most recent visit signal, labels unverified empty collection explicitly, clears stale realtime tables after a failed refresh, and prevents a late performance event from moving or reactivating a departed visit. Its authenticated production checks and five public resource checks passed before frontend activation.

The public analytical product stays static on GitHub Pages. A separate Cloudflare Worker serves only `politicalverse.se/admin*` and `politicalverse.se/insights/*`. It never reads or changes election source data. Authentication, reporting and collection must fail closed if the Worker or database is unavailable. The public site must remain usable.

## Measurement contract

Collection starts only after an explicit statistics choice. The equally available decline choice leaves the website usable. Preferences can be reopened from the footer or `/privacy/`; withdrawal immediately stops measurement and pending requests and removes local analytics identifiers, including when the choice changes in another tab. No reload is needed. If browser storage cannot be written, the current document still honors the choice. Preferences expire after 180 days.

A visit is a random, tab-scoped ID, renewed after 30 minutes without a signal. It is not a unique person. Events are deduplicated by random event ID. A page view records an initial page, a route change or a visible page resumed as a new visit after inactivity, including Swedish/English routes, but query/filter changes count as feature use rather than new page views. Filter, sort, search, source and PocketPolitics events record only approved categories. Search usage counts the first interaction with each search field per route, never individual keystrokes or phrases. Scroll milestones are 50% and 90% once per page visit.

Routes, campaigns and event labels use an explicit closed vocabulary. Query strings, fragment identifiers, input values, search phrases, candidate/party selections, error messages/stacks, full referrer URLs and raw user-agent strings cannot enter the analytics tables. The first source category and landing route are retained for each visit. Browser, device and OS are coarse user-agent classifications, not guaranteed hardware identification. Screen/window dimensions are CSS pixels.

Active visits have a signal in the last 90 seconds. A visible document sends a heartbeat every 30 seconds while there has been interaction in the last five minutes. Hiding or leaving the page ends its active state when the final request arrives; otherwise it expires within 90 seconds. Active time is estimated foreground time, capped per heartbeat. A last page is reported as an exit only after 30 minutes without activity. Visits and page views are reported for rolling windows of 1, 7, 30 or 90 days, with daily chart labels in Europe/Stockholm. Comparisons stay unavailable until the retained data covers the preceding period.

The dashboard counts consented visits, so it cannot be described as all traffic. Blockers and unavailable collection also reduce observed traffic. It excludes authenticated administrator visits and recognisable bots; this does not guarantee detection of all bots. There is no screen recording, fingerprinting, advertising profile, inferred political preference or cross-site identity.

Real User Monitoring uses `web-vitals` LCP, INP and CLS. The dashboard groups up to the latest 10,000 samples per selected period by route and metric and reports nearest-rank p75 with sample counts. LCP/INP are milliseconds; CLS is unitless. Field data is not a synthetic Lighthouse result. A small sample cannot establish a stable performance trend.

HTTP checks cover the public homepage and four published data resources. A 200 response proves availability, not freshness or arithmetic of all upstream data. The independent election data manifests and validation workflows remain authoritative for those checks.

## Infrastructure and retention

- Dedicated account: the owner's existing Cloudflare account.
- Zone: `politicalverse.se`.
- Worker: `politicalverse-insights`; no workers.dev or preview URL.
- D1: `politicalverse-insights`, created with EU jurisdiction. Its identifier is a configuration identifier, not a credential.
- Events and visits older than 90 days are purged daily. Expired security/session records are removed in the same job.
- Public browser analytics starts only on `https://politicalverse.se`, never local development or the legacy GitHub origin.
- `/insights/config` exposes only the public measurement ID and whether the current authenticated admin should be excluded.

## Authentication

Username is `admin`. The password is independently generated with high entropy; it is never shared with the registrar or Google account. `ADMIN_PASSWORD_HASH` contains PBKDF2-SHA256 with a random 16-byte salt and 100,000 iterations (the Workers Web Crypto iteration limit). `SESSION_SECRET` is a separate random secret used for keyed abuse-control hashes. Both are encrypted Cloudflare bindings, absent from the static export and git history.

The `__Host-pv_admin` cookie is Secure, HttpOnly and SameSite=Strict, scoped to `/`, with an eight-hour lifetime. D1 stores only a SHA-256 digest of the random 32-byte session token. Logout removes the server session and cookie. Login/logout require the exact origin. Login is bounded to ten attempts per source IP in 15 minutes; collection is bounded to 240 requests per IP per minute. Abuse-control storage contains an expiring HMAC, never the raw IP. This separate security data is not exposed in reports.

Every dashboard/API/script request is authenticated server-side. HTML has a restrictive CSP, no-store caching, frame protection and noindex. Report cells use DOM text nodes rather than HTML interpolation. Request bodies are bounded while streaming. Nothing is protected merely by hiding a link or client-side password check.

## Google Analytics

Google is not part of the shipped collector. The following is the plan for a future separate connection, not an active integration.

Use only the Google account explicitly designated by the owner in the private handoff. Never reuse another signed-in account's stream or publish the owner's account address in this runbook. The Worker has an empty `GA_MEASUREMENT_ID` until an actual matching web stream is created and verified; first-party statistics works independently of a Google stream.

Configure the web stream for `https://politicalverse.se`, Swedish reporting time, SEK and no advertising features. Disable automatic enhanced-measurement page changes/search/forms/outbound clicks/scrolls: the future integration must send sanitised manual page views and approved feature events. `send_page_view: false` alone does not disable enhanced measurement history events. Keep Google Signals and ad personalisation off, analytics-only consent, no tag/pings before consent, and no query-bearing URLs. Register `pocketpolitics_click` as a key event if referral measurement is the agreed conversion. Use short event retention and disable reset on new activity where offered. Verify consent denial, one manual page view per route, browser debug/realtime reception and absence of duplicate automatic events before calling GA active.

Sources: [Google consent](https://developers.google.com/tag-platform/security/guides/consent), [manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views), [PTS cookie guidance](https://pts.se/internet-och-telefoni/kakor-cookies/), [IMY consent](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/rattslig-grund/samtycke/).

## Release and recovery

Use Node 22 or newer, installed dependencies and the authenticated owner account. Never place credentials in a command argument, environment committed to git, public asset or report. Put encrypted secrets through Wrangler's stdin or a temporary mode-0600 file outside this repository. Keep a private copy in the owner's password manager.

```sh
npm run data:verify
npm run check
npx wrangler deploy --dry-run --config workers/insights/wrangler.jsonc
npx wrangler d1 migrations apply politicalverse-insights --remote --config workers/insights/wrangler.jsonc
npx wrangler deploy --config workers/insights/wrangler.jsonc
```

The ten `tests/insights-client.test.mjs` cases exercise the actual browser module with isolated storage, clocks and network responses: consent before collection, route sanitization/order, admin exclusion, delayed configuration, withdrawal across tabs, blocked storage, session expiry, background signals and recovery after a configuration failure.

The isolated `test:insights` suite exercises the bundled Worker with disposable D1 storage, origin/consent filtering, secret validation, rate limiting, secure sessions, direct unauthenticated endpoints, deduplication, route sanitisation, realtime navigation, engagement and logout/expiry. It binds only `127.0.0.1:4317`; do not run alongside Next development. Public Pages workflows include Worker type/integration tests but do not automatically deploy Worker code or rotate secrets.

After deployment verify both unauthenticated and authenticated production responses, a real consented visit and its sanitised URL, withdrawal, admin exclusion and mobile layout. Remove only explicitly identified synthetic verification records; never truncate real visitor data. If a Worker release fails, roll back that Worker version independently. Do not roll back election data or change public DNS to repair an analytics problem.

To rotate the password, generate a new independent random value and PBKDF2 salt/hash, replace the encrypted `ADMIN_PASSWORD_HASH`, then delete `admin_sessions` to revoke existing access. Retain no plaintext password in this document. Restore data from D1 Time Travel only for a confirmed storage incident; a deployment rollback does not roll back the database.

## Browser verification, 8 September 2026

The real HTML login form initially sent `Origin: null` because the response used `Referrer-Policy: no-referrer`. The origin-protected endpoint correctly refused it. The policy is now `same-origin`: same-origin form submissions retain their origin, while external destinations receive no referrer. Browser login and logout were then verified against an isolated local Worker with an ephemeral D1 database. Do not weaken the endpoint to accept a null origin.

A local-only scenario with three visits and six page events verified three active `/rankings/` visits, six total pageviews, three `/maps/` to `/rankings/` transitions and the expected device/screen classifications. Empty states were checked before insertion. These test events were never sent to production. The local database is discarded on shutdown.

Production HTTPS verification at 14:23–14:29 UTC passed login/logout, protected report/script endpoints, secure session flags and revocation, admin exclusion, an honestly empty report and the crown image. Requests retained the actual hostname and TLS certificate verification while selecting the live Cloudflare address because the local ISP still cached Loopia parking. Cloudflare and Google public DNS resolvers both validated the new DNSSEC chain. A local-network browser check remains separate until that cache expires.

The initial resource check used `redirect: "error"`, which the actual Workers runtime rejects even though the Request documentation lists it. It now uses `manual`: redirects remain visible non-success statuses and are not followed. An isolated outbound-service regression covers successful HEAD responses, a 503 and an unfollowed 302 without contacting production. All five production resources then returned 200. The suite now has 10 passing tests.
