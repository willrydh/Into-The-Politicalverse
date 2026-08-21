# Valmyndigheten geography — 2022 Election Map

Last verified: **2026-08-21**

## Authority and reuse

Politicalverse uses the 21 county GIS archives published under **Valdistrikt i val 2022 — kartor** by Valmyndigheten:

- source page: `https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022`
- open-data terms: `https://www.val.se/valresultat-och-statistik/statistik-och-data/om-var-oppna-data`
- publisher: Valmyndigheten
- underlying geometry supplier: the county administrative boards
- source date encoded in the files: 2022-09-10
- source coordinate reference system: SWEREF 99 TM (`EPSG:3006`)

Valmyndigheten states that the data may be reused with attribution. Politicalverse identifies Valmyndigheten beside the map and links to the source page.

Every archive URL, retrieval date and SHA-256 checksum is pinned in [`data/raw/valmyndigheten/geography-source-manifest.json`](../../data/raw/valmyndigheten/geography-source-manifest.json). Downloaded ZIP files are reproducible inputs and intentionally remain untracked.

## Normalization contract

The checked-in normalized file is [`data/normalized/municipality-boundaries-2022.geojson`](../../data/normalized/municipality-boundaries-2022.geojson).

The deterministic adapter:

1. downloads or reads all 21 county archives;
2. verifies every archive checksum;
3. verifies the county prefix of every `Lkfv` district code;
4. cleans source topology;
5. dissolves geometry by the first four characters of `Lkfv`, the municipality code;
6. retains 5% of removable vertices with shapes preserved;
7. reprojects from `EPSG:3006` to WGS 84 (`EPSG:4326`);
8. joins municipality names and final Riksdag results by the stable four-digit code;
9. validates all coordinates and the exact 290-code coverage;
10. writes a checksum-pinned GeoJSON feature collection.

The normalizer is pinned to `mapshaper@0.6.113`. To keep this import-only tool out of the installed application dependency graph, the adapter uses `POLITICALVERSE_MAPSHAPER_BIN` when supplied, then a local binary when present, and otherwise invokes that exact pinned version through `npx`. Source archive checksums are verified before mapshaper is allowed to run.

Regenerate from already downloaded archives with:

```bash
npm run data:import:geography -- --source-dir /path/to/archive-directory
```

Without `--source-dir`, the adapter downloads the archives to the ignored `data/raw/downloads/valmyndigheten-geography-2022` directory.

## Counts and interpretation

- source physical district features: **6,264**
- normalized municipality features: **290**
- official 2022 result reporting districts in the vote workbook: **6,578**

The counts differ because reporting includes collection/aggregation districts that do not have independent physical polygons in the published GIS archives. The map does not join result values at district level: official votes are first aggregated to municipality in the result adapter, then joined to the 290 dissolved municipality geometries.

The map shows final 2022 **Riksdag** vote share and turnout plus `DERIVED` 2018–2022 party swing and turnout change by municipality. It does not represent municipal council election results or political control. Exact source observations retain the `OFFICIAL` classification; calculated changes are explicitly labelled `DERIVED`. The discrete color scales are display transformations and are described beside the map.

## Version boundary

The 2022 result map uses only 2022 geometry. Do not silently replace it with 2026 boundaries. A future 2026 map must receive its own source manifest, normalized artifact and comparability rules.
