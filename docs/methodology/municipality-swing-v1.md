# Municipality swing — v1.0.0

Classification: **DERIVED**

## Definition

For party `p` and a municipality with an exact official code-and-name match in both elections:

`swing(p) = vote share 2022(p) − vote share 2018(p)`

The unit is **percentage points**, not percent change. Turnout change uses the same subtraction over official final turnout:

`turnout change = turnout 2022 − turnout 2018`

Positive values mean a higher share in 2022; negative values mean a lower share. Zero is neutral.

## Inputs and comparability

- final 2018 municipality Riksdag counts from Valmyndigheten;
- final 2022 district-level Riksdag counts from Valmyndigheten, aggregated deterministically to municipality;
- Valmyndigheten's published 2018–2022 election-area comparability statement;
- exact match on all 290 municipality codes and names.

No interpolation, polling, demographic estimate or boundary substitution is used. The visual map uses 2022 geometry only as the display surface for the officially comparable municipality observations.

## Geographic breadth

For each party, Politicalverse counts municipalities where swing is positive, negative or zero. The displayed breadth value is the unweighted share of comparable municipalities with positive swing:

`breadth(p) = improved municipalities(p) / comparable municipalities`

Each municipality receives one observation regardless of population. This measures territorial breadth, not the number of voters represented by the gain.

## Limitations

- Municipality-level results cannot establish individual voter movement.
- A positive swing can be very small; breadth does not encode magnitude.
- The metric compares only 2018 with 2022.
- Results are Riksdag votes, not municipal council votes or municipal political control.

## Version history

- `1.0.0` — exact 2018–2022 municipality swing, turnout change and unweighted breadth over 290 comparable municipalities.
