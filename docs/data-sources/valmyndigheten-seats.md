# Valmyndigheten seat-allocation sources

Retrieved: 2026-08-21

Publisher: Valmyndigheten

Classification: **OFFICIAL** source observations and rule parameters

Politicalverse uses source snapshots for three distinct purposes:

1. 2018 final constituency votes and official mandate allocation form the first full engine backtest.
2. 2022 final constituency votes, the official fixed-seat allocation and the final Riksdag decision form the second full engine backtest and the geographic vote-pattern baseline.
3. The official 2026 fixed-seat workbook supplies the number of fixed seats in each of the 29 constituencies for hypothetical 2026 scenarios.

The exact URLs, retrieval date, input SHA-256 values, official expected party totals and normalized-output checksum are maintained in `data/raw/valmyndigheten/seat-source-manifest.json`. Downloaded HTML, spreadsheet and PDF snapshots live under the intentionally ignored `data/raw/downloads/` directory; they are not committed.

Regenerate the normalized input:

```bash
npm run data:import:seats
npm run data:verify
```

The importer fails closed when a source checksum, workbook sheet, constituency name, national vote total, fixed-seat total or official party allocation differs from the manifest.
