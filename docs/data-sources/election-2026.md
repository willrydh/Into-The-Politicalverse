# Official 2026 data sources

Reviewed and fetched on 6 September 2026. Authority: [Valmyndigheten's raw-data catalogue](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026). Public reuse requires attribution. Production facts and rehearsal observations are separate.

## Connected sources

| Source | Use and current verification |
| --- | --- |
| [Signed result archives and technical specification](https://www.val.se/valresultat-och-statistik/statistik-och-data/teknisk-beskrivning-av-resultatfiler) | National Riksdag results and 29 constituencies. Both official rehearsal phases pass RSA/SHA-256 verification, vote reconciliation and independent fixed/adjustment/total seat checks. The production index returns 404 before publication; no production votes have been received. |
| [Advance votes received](https://data.val.se/filer/val2026/rostmottagning/mottagna-fortidsroster-val2026.csv) | CSV updates at 06:00 and 14:00 Swedish time. 1,779,415 received votes in the 6 September snapshot. The SUMMA row is checked and excluded from aggregation. County and municipality codes must be concatenated. Daily values can be incomplete or corrected. |
| [Eligible Riksdag voters](https://www.val.se/download/18.1a2972da19f159e73fd3b4a/1787064446298/antal-rostberattigade-per-valdistrikt-uppdelat-pa-kon-och-alder-kvalifikationsdagen-14-augusti-2026-val-till-riksdagen.xlsx) | Qualification date 14 August: 8,046,725 eligible, 483,182 first-time voters and 226,906 abroad. Municipality, district, sex and age sums verified. Not a substitute for the eligible-voter denominator in counted districts on election night. |
| [2026 district list](https://www.val.se/download/18.332cf48819bd61ac151499d/1779801380664/valdistrikt-hela-landet-2026.xlsx) and [2022–2026 comparability](https://www.val.se/download/18.1a2972da19f159e73fd3a47/1787064655347/valdistrikt-jamforelser-mellan-2022-och-2026.xlsx) | 6,312 current districts, 290 municipalities and 29 constituencies. 5,024 directly comparable, 35 comparable against several previous districts, 1,253 not comparable. Multi-district links retain every predecessor. |
| [Participating parties](https://data.val.se/filer/val2026/parti/deltagande-partier.csv) and [reporting parties](https://www.val.se/download/18.1a2972da19f159e73fd531f/1788440324464/rapportpartier-valen-2026.xlsx) | 168 unique Riksdag parties in the checked register; eight reporting parties for the preliminary count. Codes retain leading zeros. Participation and reporting are different sets. |

The preparation downloads are pinned in `data/raw/valmyndigheten-2026/preparation-source-manifest.json`. Regenerate with `npm run data:import:preparation`. A changed workbook requires an explicit source review and new checksum; it must not silently replace the accepted geography or eligibility basis. The normalized API exposes the source list and retrieval date.

## Additional verified discovery

These are available sources, not claims of existing product integration:

- [Candidate CSV](https://data.val.se/filer/val2026/parti/kandidaturer.csv), updated hourly; [election-day locations](https://data.val.se/filer/val2026/rostmottagning/vallokaler.json) and [advance-voting locations](https://data.val.se/filer/val2026/rostmottagning/rostningslokaler.json).
- [2026 district GIS](https://www.val.se/download/18.332cf48819bd61ac1513889/1785491689960/valdistrikt-riket-2026.zip): GeoJSON in SWEREF99 TM. Historical maps still use verified 2022 geometry; no automatic boundary substitution.
- [SCB PxWeb API v2](https://statistikdatabasen.scb.se/api/v2/index.html): specification and `GET /tables?query=valdeltagande&lang=sv&pageSize=5` verified. Metadata exposes election participation and demographic tables. Query region/time dimensions explicitly before joining observations. This contextual/historical data is not a new poll or a live vote count.
- [Parliament's open data](https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/): members, documents and votes for parliamentary context.
- [Swedish National Election Studies](https://www.gu.se/valforskningsprogrammet/undersokningar/valundersokningar) and [historical SVT Valu](https://www.svt.se/datajournalistik/valu2022/valjargrupper/): survey and research context. No verified open live feed for Valu 2026 was found. An exit poll would be a survey layer, not counted votes.

## Authenticity and availability

Production: `https://resultat.val.se/resultatfiler/val2026/index.md5`.

Rehearsal: `https://resultat.val.se/resultatfiler/genrep2026/index.md5`.

The MD5 index detects archive changes and transfer errors; it is not an authenticity proof. Each selected JSON file has a detached RSA/SHA-256 signature. The reviewed [certificate](https://resultat.val.se/keys/val-sign-crt.pem) is pinned at SHA-256 `084c0b29d5a12fe89f2bf115e68a605e59c4dc03ecbde55e8d959669cc1fd048`, valid 25 May 2026 through 25 July 2028. Key rotation requires review. Tests retain compressed official rehearsal JSON, signatures and provenance, explicitly marked as test data.

Only the national mandate JSON is decompressed. It includes the national and constituency vote counts. The much larger district vote file is intentionally not inflated or used. Downloads, archive paths, decompressed size, election identity, source clock, revision and totals are bounded/validated.
