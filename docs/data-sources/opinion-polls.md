# Swedish opinion-poll source

Classification: **POLL** — survey estimates, not official election results and not Politicalverse model output.

Dataset: `SwedishPolls/Data/Polls.csv`

Publisher: SwedishPolls contributors

License: **CC0 1.0** for the data; the upstream code is MIT-licensed.

## Accepted source snapshot

Politicalverse stores the accepted raw CSV at `data/raw/polls/SwedishPolls.csv` and its machine-readable provenance at `data/raw/polls/source-manifest.json`. The manifest, rather than this prose page, is authoritative after each refresh.

The bootstrap snapshot was accepted on 2026-08-21:

| Field | Accepted value |
| --- | --- |
| Upstream file commit | `5df438f4038cb36429c1049fa60b064dd044d191` |
| Commit time | `2026-08-19T06:35:10Z` |
| Rows excluding header | 2,636 |
| Latest publication date | 2026-08-19 |
| Raw SHA-256 | `6d583cfb45eb022374a6275e721d701d48c091e64fa002efdddaeb5eb2c02472` |

The manifest also pins the normalized forecast SHA-256. A source change is not accepted merely because an HTTP request succeeds.

## What the source contains

Each row can contain pollster/company, normalized house identity, publication month and date, fieldwork start/end, an approximate-fieldwork flag, sample size and estimates for the Swedish parties. Some historical rows lack modern parties or exact dates. Politicalverse preserves that missingness; it does not silently replace a missing party estimate with zero.

The upstream repository notes that coverage before 2000 is less reliable, that the data are generally better after 2008 and that Ipsos/DN values can involve rounding or normalization. Those caveats remain upstream-source limitations. The current eight-party forecast requires complete modern party shares and a real publication date.

The displayed interview total is the sum of reported sample sizes in the active window. Respondents can appear in more than one poll, so it is explicitly labelled as non-unique and must not be described as a count of distinct people.

## Independent primary cross-checks

The source manifest carries exact anchors checked against primary or public-service publications after the explicitly reviewed source-date corrections. The generator and scheduled updater refuse the snapshot when any anchored value changes or disappears.

| Publisher | Publication | M | L | C | KD | S | V | MP | SD | n |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Novus | 2026-08-19 | 18.3 | 1.9 | 7.1 | 6.3 | 30.1 | 7.4 | 7.9 | 19.1 | 5,617 |
| SVT / Verian (`Sifo` in the CSV) | 2026-08-17 | 17.3 | 1.9 | 8.0 | 6.2 | 30.5 | 7.7 | 7.7 | 18.5 | 3,043 |
| SCB | 2026-06-04 | 17.3 | 2.5 | 6.1 | 4.5 | 33.9 | 8.6 | 6.6 | 18.3 | 4,542 |

The anchors verify important recent observations; they do not turn SwedishPolls into an official source and are not a substitute for reviewing every pollster's fieldwork methodology.

## Source review on 6 September 2026

The accepted bank now has 2,646 rows at commit `b278737c7cdc4da9dc4cd659c84704bfe730ab41`, with a latest publication on 4 September and 36 polls from seven houses in the active window. The manifest remains authoritative after subsequent updates.

Four additional anchors were checked: all eight party shares in Novus's September report; all eight shares and sample size in Verian's 3 September report; S, L and sample size in Demoskop's 3 September report; and S/L in Sveriges Radio/Indikator's 4 September publication. The expected fields are explicit in the manifest; a partial anchor does not imply that every value in that poll was independently checked. Original August and SCB anchors remain in place.

The latest Ipsos publication reproduces the bank's August observation (11–23 August, 1,661 interviews). The publicly accessible Riks/Sentio report of 27 August agrees on S/M; its L value 2.13 rounds to the bank's 2.1. Its full report requires access, so a full independent eight-party cross-check is not claimed. These sources are included through the checksum-pinned bank, not scraped during each scheduled run.

### Reviewed date correction

Adapter `pv-swedishpolls-1.1.0` changes the Novus observation with fieldwork 24–30 August from the bank's publication date 1 September to **2 September**, the date of [Novus's primary report](https://novus.se/wp-content/uploads/2026/09/novusvaljarbarometerseptember2026h3q8v5.pdf). The eight shares and 2,984 interviews match. This prevents the observation appearing in the 1 September replay. Raw CSV bytes and their checksum are preserved. The correction, source URL, check date and adapter version are published in forecast JSON and the method section, and affect snapshot identity. A future upstream fix to 2 September is accepted idempotently; an unexpected third date requires review. The statistical model remains `1.0.0-beta.1`.

## Automated refresh and quarantine

`.github/workflows/data-refresh.yml` checks the source every six hours and can also be started manually. The updater:

1. resolves the latest commit on `master` that touched `Data/Polls.csv`;
2. downloads the CSV at that immutable commit and compares it byte-for-byte with the current `master` file, refusing a race;
3. verifies the exact CSV schema, a non-shrinking row count, non-regressing latest publication and source-commit dates, a complete latest eight-party observation and at least two complete recent polls;
4. rejects duplicates, impossible calendar dates instead of allowing parser rollover, future Swedish publication dates, post-election cutoffs, reversed fieldwork, invalid sample sizes, impossible party values/totals and failed primary cross-checks;
5. regenerates the 10,000-run forecast in memory and calculates both raw and normalized SHA-256 values;
6. replaces the raw CSV, manifest and normalized forecast through same-directory temporary files and atomic renames only after all checks pass.

If validation, generation, the repository verification gate or the full application check fails, the workflow creates no commit. The updater restores the previous files if a write fails. GitHub Pages therefore continues to serve the last-known-good forecast instead of publishing suspect data.

A successful changed run commits the accepted snapshot to `main` with the repository `GITHUB_TOKEN`. GitHub does not start a second push workflow for a commit made with that token, so `data-refresh.yml` also checks out the exact emitted commit SHA, repeats data/lint/type/test gates, builds the Pages artifact and deploys it with `pages:write` plus GitHub's OIDC token. The deploy job shares the `pages` concurrency group with the normal Pages workflow and verifies immediately before deployment that `main` still equals the accepted SHA. It therefore neither deploys an unchanged run nor lets an older refresh overwrite a newer main release. No PAT or external hosting target is involved.

Run the same refresh manually:

```bash
npm run data:polls:update
npm run data:verify
npm run check
```

When the upstream file, file commit and source-correction policy are unchanged, the updater validates them but leaves all tracked files untouched. A reviewed adapter/correction change regenerates the forecast even if upstream bytes are unchanged.
After election day the scheduled updater exits before contacting upstream and retains the last pre-election forecast. Forecast generation independently rejects a cutoff after `2026-09-13`, preventing a negative horizon or a historical replay after election day.

## References

- SwedishPolls, [repository and data notes](https://github.com/MansMeg/SwedishPolls)
- SwedishPolls, [master CSV](https://raw.githubusercontent.com/MansMeg/SwedishPolls/master/Data/Polls.csv)
- Novus, [Väljarbarometer August 2026](https://novus.se/valjarbarometer-arkiv/2026-08-novus-valjarbarometer/)
- SVT Nyheter / Verian, [August 2026 voter barometer](https://www.svt.se/nyheter/inrikes/kristersson-pressas-ny-matning-visar-stort-gap)
- SCB, [Partisympatiundersökningen May 2026](https://www.scb.se/hitta-statistik/statistik-efter-amne/demokrati/partisympatier/partisympatiundersokningen-psu/pong/statistiknyhet/partisympatiundersokningen-maj-2026/)
- Creative Commons, [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)

## Visible age

The home and forecast pages always show the latest measurement publication date. After hydration, age is calculated from the browser clock in Europe/Stockholm and rechecked every minute and on focus, independent of a new deployment. More than seven days displays a stale-underlay notice. After election day, the retained forecast is labelled as archived and explicitly distinguished from a result. A recent date is not a claim that every upstream service is healthy.
