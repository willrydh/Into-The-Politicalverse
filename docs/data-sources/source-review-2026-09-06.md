# Source and system review — 6 September 2026

This review covers all data families used by the existing Politicalverse release. It does not claim that planned data adapters are already implemented.

## Official data

All 32 distinct URLs in the official election, municipality-history, seat and geography source manifests were fetched again. **28 of 28 checksum-pinned files matched** byte for byte; the other four historical national-result pages returned HTTP 200. The 2018 national page is also checksum-pinned through the seat manifest. The machine-readable [verification result](verification/2026-09-06-official-sources.json) records timestamp, URL, byte count, expected hash and observed hash for every request.

This includes the 2022 final-vote workbook, 2018 municipality workbook, all 21 county GIS archives, historical seat workbooks/decision and **the official 2026 fixed-seat allocation**. Historical result years and 2022 geometry remain correct historical data. Retrieval/check dates must not be substituted for election dates. `data:verify` checks canonical totals, joins, hashes and exact 2018/2022 seat allocations.

## Polling

The pinned bank advanced from 2,636 to 2,646 rows, source commit `b278737c7cdc4da9dc4cd659c84704bfe730ab41`, with publication cutoff **4 September 2026**. The active 180-day window contains 36 observations from seven houses. The frozen model still runs 10,000 simulations.

| House | Latest bank observation | Source reviewed | Scope |
| --- | --- | --- | --- |
| Indikator | 4 September | [Sveriges Radio](https://www.sverigesradio.se/artikel/s-minskar-kraftigt-l-langt-under-riksdagssparren-historiskt-daligt) | Publication and S/L values; exact anchor added |
| Verian/Sifo | 3 September | [Verian](https://www.veriangroup.com/sv/news-and-insights/valjarbarometer-september-2026) | All eight shares, 3,069 interviews, fieldwork; anchor added |
| Demoskop | 3 September | [Demoskop](https://demoskop.se/valjarbarometer-september-2026/) | S/L values, 1,998 interviews, fieldwork; anchor added |
| Novus | 2 September after correction | [Novus report](https://novus.se/wp-content/uploads/2026/09/novusvaljarbarometerseptember2026h3q8v5.pdf) | All eight shares, 2,984 interviews and fieldwork; shares anchored and publication corrected from 1 September |
| Sentio | 27 August | [Riks, commissioning publisher](https://riks.se/nyheter/riks-sentio-socialdemokraterna-tokrasar) | Public S/M values and rounded L agree; full report is behind access control and was not independently checked |
| Ipsos | 25 August | [Ipsos report page](https://www.ipsos.com/sv-se/dnipsos-uppat-liberalerna-men-fortsatt-langt-avstand-till-socialdemokraterna-far-sin-lagsta-siffra) | All eight shares, 1,661 interviews and fieldwork match; provider page is dated 1 September and reproduces the earlier August observation |
| SCB | 4 June, May fieldwork | [SCB PSU](https://www.scb.se/hitta-statistik/statistik-efter-amne/demokrati/partisympatier/partisympatiundersokningen-psu/pong/statistiknyhet/partisympatiundersokningen-maj-2026/) | Latest annual May PSU; all eight shares and 4,542 respondents match the retained anchor |

SwedishPolls remains an aggregation with incomplete older coverage and documented rounding limitations. The review found no newer usable national observation in these checked source publications. It is not a claim to ingest every political data source on the internet. See [poll source policy](opinion-polls.md) for exact anchors and the versioned Novus correction.

## Government context

Constitutional rules and each retained source were re-read. The registry check date is now 6 September. The update adds [KD’s September rejection of Andersson](https://www.svt.se/nyheter/inrikes/s-toppens-pik-till-busch-sager-en-sak-innan-valet), uses [C’s own dated middle-alternative statement](https://www.centerpartiet.se/nyheter/arkiv-2026/2026-08-19-centerpartiet-lanserar-nytt-alternativ-en-stark-mittenregering), and replaces V’s leader-source reference with a source that actually identifies the leader. C’s and MP’s incompatible positions are described as dated statements, not modeled outcomes. Historical versions remain in Git. The automated poll job does not alter this registry.

## System defect and safeguards

The refresh job fetched and validated newer polls but the test suite demanded historical poll counts fixed to 19 August. The replay horizon moves with the live cutoff, so those counts are expected to change. Tests and verification now check each actual historical cutoff, count, house count and the immutable calibration/holdout split. A regression covers 19 August and 4 September. The earlier insufficient-recent-polls rejection remains an intentional source-quality failure; it is not suppressed.

A primary-source date correction is applied in the adapter, preserving original raw bytes, and is included in forecast identity and public provenance. Date-age notices on both forecast entry points continue aging in the browser if a future deployment fails; after election day they label the forecast as archived. Notification settings and six-hour cadence are unchanged.

## Boundaries before election day

[Valmyndigheten’s 2026 source page](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026) now includes candidate/party feeds and current technical information. Those feeds and election-night preliminary/final result adapters are still separate future product work. The current product uses 2026 fixed seats, national polls and historical final results. It does not claim to show live 2026 counted votes. The wider SCB socioeconomic/PxWeb integration is also not implemented; the SCB input currently used is the PSU poll.
