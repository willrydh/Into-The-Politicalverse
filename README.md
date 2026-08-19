# Into The Politicalverse

Quantitative election analysis built from traceable official data.

## Product principles

1. No mystery numbers. Every value is Official, Derived, or Model.
2. Valmyndigheten is the source of truth for Swedish official election results.
3. Raw source records are immutable; changes are represented as new snapshots.
4. Responsive by default: phone, tablet, laptop and large desktop are first-class targets.
5. Party identity is centralized in `lib/parties.ts`; official logo assets are stored locally with provenance.
6. Authentication and billing are deliberately decoupled from the data and analytics layers.

## Initial product structure

- Overview
- Charts
- Parties
- Maps
- Elections
- Indicators
- Simulator

## Data pipeline

`source adapter -> raw snapshot -> validation -> normalization -> derived metrics -> application data layer -> UI`

Initial authorities:
- Valmyndigheten: elections, parties, candidates, districts, results, turnout, mandates, GIS.
- SCB PxWeb: aggregate demographic/economic context.
- Politicalverse: reproducible derived indicators and models.

## Development

```bash
npm install
npm run dev
```

Current foundation branch: `agent/foundation`.