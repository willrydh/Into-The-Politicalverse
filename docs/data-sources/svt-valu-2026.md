# SVT Valu 2026

Classification: **POLL**. A national Riksdag exit-poll snapshot, retrieved on 13 September 2026 at 20:43 Swedish time. It appears on both language versions of the election-night page and is linked from the homepage and source register.

## Source and review

- [SVT's government puzzle](https://www.svt.se/datajournalistik/val2026/pussla-ihop-sveriges-regering/) explicitly identifies Valu as its initial survey source, separate from later projections and preliminary election results.
- Its embedded `9s5AM` widget reads [the source index](https://www.svt.se/special/articledata/5362/pussla_sources.json). The index's `valu` property points to [mandat.json](https://www.svt.se/special/articledata/5362/mandat.json). The accepted copies and SHA-256 checksums are in `data/raw/svt-valu-2026/`.
- Only the eight `procent` fields and `_meta.ovr_utesluten_pct` are imported. SVT's widget uses these as party shares. Its simulated votes, fixed seats, adjustment seats and mandate totals are deliberately excluded from the survey domain object.
- [SVT's election live report](https://www.svt.se/nyheter/inrikes/senaste-nytt-om-val-2026?inlagg=12b668d99c659282f30d70a0f0afb2ea), retrieved at 20:38, describes 13,709 voters at selected polling and advance-voting locations. Its HTML checksum and retrieval time are preserved in the manifest; the complete article is not redistributed in this repository.
- The live report's individual MP entry says 7.4%, while its pinned summary says 7.0%. The widget's underlying survey value is 7.38%, supporting the individual entry. We use the structured source consistently for every party rather than combining incompatible rounded posts.
- The raw widget timestamp is `2026-09-13T19:32:02Z`, ahead of our retrieval. It is preserved verbatim but is **not** treated as a verified publication/update time or used for freshness. The UI displays our actual retrieval time.

## Arithmetic and boundaries

The adapter requires the exact eight-party coverage, 2026 election identity and reviewed `valu` URL. Missing, nonnumeric, negative or out-of-range percentages fail validation. Shares plus other parties must sum to 100 within the maximum rounding tolerance of nine two-decimal source values (0.045 percentage points).

Source shares sum to 99.99%. They are not renormalized. The UI rounds each to one decimal, so displayed totals can differ slightly from 100%. Other parties are taken from the source's 1.96%, never fabricated from respondent counts. No bloc seats, winner probabilities or confidence intervals are inferred from this snapshot.

The sample size is descriptive, not a vote denominator. The snapshot has no municipality, district, demographic subgroup or respondent-level data. It does not enter the official result feed, candidate history, the frozen pre-election reference or the election-night nowcast. It remains visible when official results are unavailable and when users switch counting stages; its national scope remains explicit.

## Updates

This is a reviewed snapshot, not a live SVT connector. Corrections require retrieving and reviewing the index and survey JSON again, preserving their hashes and retrieval times, reconciling the source figures, and updating the snapshot and regression expectations in one release. Never follow the index's `prognos` or `valresultat` entries as Valu. Keep past versions in Git.

Run `npm run data:verify` and `npm run check` before release. Unit tests cover source identity, checksum preservation, sample metadata, rejected partial/conflicting data, null versus zero, rounding, and exclusion of the widget's simulated votes and seats.
