# Valmyndigheten municipality history — 2018 Riksdag

Last verified: **2026-08-21**

## Source and provenance

The 2018 municipality baseline comes from Valmyndigheten's final `2018_R_per_kommun.xlsx` workbook:

- authority: Valmyndigheten;
- election: Riksdag, 9 September 2018, final result;
- coverage: all 290 municipalities;
- source URL, retrieval date and SHA-256: [`data/raw/valmyndigheten/municipality-history-source-manifest.json`](../../data/raw/valmyndigheten/municipality-history-source-manifest.json);
- checked-in normalized output: [`data/normalized/riksdag-municipalities-2018.json`](../../data/normalized/riksdag-municipalities-2018.json).

The downloaded workbook is reproducible and intentionally untracked. The normalized artifact is checksum-pinned so any change is detected by `npm run data:verify`.

## Validation contract

The source adapter reads the official count and percentage worksheets with the repository's bounded XLSX parser. Import fails unless:

1. both expected worksheets and municipality columns exist;
2. every municipality has a unique four-digit official code and name;
3. all 290 municipalities are present;
4. official party counts plus the normalized `OTHER` remainder equal valid votes in every municipality;
5. municipal totals reconcile exactly to 6,476,725 valid votes, 6,535,271 total votes and 7,495,936 eligible voters;
6. national party totals match the manifest;
7. stored percentages match vote-derived shares.

Regenerate with:

```bash
npm run data:import:municipality-history
```

or pass an already downloaded workbook with `-- --file /path/to/2018_R_per_kommun.xlsx`.

## Comparability boundary

Valmyndigheten states that the 2018 and 2022 results are comparable at election-area level and that no election areas changed between those elections. Politicalverse still fails closed: a comparison is created only when the official municipality code and name match exactly across both normalized sources.

The map renders the comparison on the checksum-pinned 2022 municipality geometry. It does not claim that other historical boundary vintages are interchangeable.
