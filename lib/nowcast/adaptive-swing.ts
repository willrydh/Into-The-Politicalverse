import {
  NOWCAST_PARTIES,
  type BaselineUnit,
  type Observation,
  type Votes,
} from "./types";

const P = NOWCAST_PARTIES.length;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const total = (v: Votes) => sum(NOWCAST_PARTIES.map((p) => v[p]));
const vector = (v: Votes) => NOWCAST_PARTIES.map((p) => v[p] / total(v));
const dot = (a: number[], b: number[]) => sum(a.map((x, i) => x * b[i]));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const zeros = (n: number) => Array<number>(n).fill(0);

export type SwingDiagnostics = {
  estimator: "national" | "regularized-geographic";
  penalty: number | null;
  effectiveDistricts: number;
  municipalities: number;
  crossValidationMaePp: number | null;
  nationalCrossValidationMaePp: number | null;
  extrapolatedVoteShare: number;
  modelDisagreementPp: Votes;
  clusterResidualsPp: Votes[];
  turnoutResidualRms: number;
};
type Row = {
  unit: BaselineUnit;
  x: number[];
  y: number[];
  weight: number;
  fold: number;
};
type Fit = {
  predict: (unit: BaselineUnit) => number[];
  leverage: (unit: BaselineUnit) => number;
};

// Scaling depends only on known electoral rolls and previous-election votes.
// Current unreported results are never read, including during cross-validation.
function design(units: BaselineUnit[]) {
  const ordinary = units.filter((u) => !u.collection);
  if (!ordinary.length)
    return { features: new Map<string, number[]>(), meanVolume: 1 };
  const raw = (u: BaselineUnit) => [
    ...vector(u.votes).slice(0, P - 1),
    Math.log(Math.max(1, u.eligible)),
    total(u.votes) / Math.max(1, u.baselineEligible),
  ];
  const volumes = ordinary.map(
    (u) => (total(u.votes) * u.eligible) / u.baselineEligible,
  );
  const weight = sum(volumes);
  const xs = ordinary.map(raw),
    dimensions = xs[0].length;
  const mean = zeros(dimensions),
    scale = zeros(dimensions);
  for (let j = 0; j < dimensions; j++) {
    mean[j] = sum(xs.map((x, i) => x[j] * volumes[i])) / weight;
    scale[j] = Math.max(
      0.001,
      Math.sqrt(
        sum(xs.map((x, i) => (x[j] - mean[j]) ** 2 * volumes[i])) / weight,
      ),
    );
  }
  const result = {
    features: new Map(
      ordinary.map((u, i) => [
        u.code,
        xs[i].map((x, j) => clamp((x - mean[j]) / scale[j], -8, 8)),
      ]),
    ),
    meanVolume: weight / ordinary.length,
  };
  return result;
}

// Positive-definite ridge systems; no matrix inverse or external ML runtime.
function cholesky(a: number[][]) {
  const l = a.map((row) => zeros(row.length));
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j <= i; j++) {
      let v = a[i][j];
      for (let k = 0; k < j; k++) v -= l[i][k] * l[j][k];
      if (i === j) {
        if (!(v > 0) || !Number.isFinite(v))
          throw new Error("Non-positive ridge system");
        l[i][j] = Math.sqrt(v);
      } else l[i][j] = v / l[j][j];
    }
  return l;
}
function solve(l: number[][], b: number[]) {
  const y = zeros(b.length),
    x = zeros(b.length);
  for (let i = 0; i < b.length; i++) {
    let s = b[i];
    for (let j = 0; j < i; j++) s -= l[i][j] * y[j];
    y[i] = s / l[i][i];
  }
  for (let i = b.length - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < b.length; j++) s -= l[j][i] * x[j];
    x[i] = s / l[i][i];
  }
  return x;
}

function fit(
  rows: Row[],
  features: Map<string, number[]>,
  penalty: number | null,
): Fit {
  const d = rows[0].x.length,
    outputs = P + 1;
  const weight = sum(rows.map((r) => r.weight));
  const mx = zeros(d),
    my = zeros(outputs);
  for (const r of rows) {
    for (let j = 0; j < d; j++) mx[j] += (r.weight * r.x[j]) / weight;
    for (let p = 0; p < outputs; p++) my[p] += (r.weight * r.y[p]) / weight;
  }
  const feasible = (u: BaselineUnit, y: number[]) => {
    const prior = vector(u.votes),
      shifted = prior.map((v, p) => Math.max(0, v + y[p])),
      denominator = sum(shifted);
    return [
      ...shifted.map((v, p) => v / denominator - prior[p]),
      clamp(y[P], Math.log(0.5), Math.log(1.5)),
    ];
  };
  if (penalty === null)
    return { predict: (u) => feasible(u, my), leverage: () => 0 };
  const gram = Array.from({ length: d }, () => zeros(d)),
    rhs = Array.from({ length: outputs }, () => zeros(d));
  for (const r of rows) {
    const x = r.x.map((v, j) => v - mx[j]);
    for (let j = 0; j < d; j++) {
      for (let k = 0; k <= j; k++) gram[j][k] += r.weight * x[j] * x[k];
      for (let p = 0; p < outputs; p++)
        rhs[p][j] += r.weight * x[j] * (r.y[p] - my[p]);
    }
  }
  for (let j = 0; j < d; j++) {
    gram[j][j] += penalty;
    for (let k = 0; k < j; k++) gram[k][j] = gram[j][k];
  }
  const l = cholesky(gram),
    beta = rhs.map((y) => solve(l, y));
  const centered = (u: BaselineUnit) =>
    features.get(u.code)!.map((v, j) => v - mx[j]);
  const leverage = (u: BaselineUnit) => {
    const x = centered(u);
    return Math.max(0, dot(x, solve(l, x)));
  };
  const base = (u: BaselineUnit) => {
    const x = centered(u),
      shrink = 1 / (1 + leverage(u));
    return my.map((v, p) => v + dot(x, beta[p]) * shrink);
  };
  const county = new Map<string, { weight: number; residual: number[] }>();
  for (const r of rows) {
    const key = r.unit.municipality.slice(0, 2),
      c = county.get(key) ?? { weight: 0, residual: zeros(outputs) },
      pred = base(r.unit);
    c.weight += r.weight;
    for (let p = 0; p < outputs; p++)
      c.residual[p] += r.weight * (r.y[p] - pred[p]);
    county.set(key, c);
  }
  const regional = (u: BaselineUnit) => {
    const c = county.get(u.municipality.slice(0, 2));
    return c ? c.residual.map((v) => v / (c.weight + 40)) : zeros(outputs);
  };
  const municipality = new Map<
    string,
    { weight: number; residual: number[] }
  >();
  for (const r of rows) {
    const m = municipality.get(r.unit.municipality) ?? {
        weight: 0,
        residual: zeros(outputs),
      },
      pred = base(r.unit),
      c = regional(r.unit);
    m.weight += r.weight;
    for (let p = 0; p < outputs; p++)
      m.residual[p] += r.weight * (r.y[p] - pred[p] - c[p]);
    municipality.set(r.unit.municipality, m);
  }
  return {
    leverage,
    predict: (u) => {
      const b = base(u),
        c = regional(u),
        m = municipality.get(u.municipality);
      return feasible(
        u,
        b.map((v, p) => v + c[p] + (m ? m.residual[p] / (m.weight + 12) : 0)),
      );
    },
  };
}

export function adaptiveSwing(
  units: BaselineUnit[],
  observations: Observation[],
  nationalDelta: Votes,
) {
  const rolls = new Map(
    observations
      .filter((o) => o.eligible! > 0)
      .map((o) => [o.code, o.eligible!]),
  );
  units = units.map((u) =>
    rolls.has(u.code) ? { ...u, eligible: rolls.get(u.code)! } : u,
  );
  const physical = new Map(
    units.filter((u) => !u.collection).map((u) => [u.code, u]),
  );
  const { features, meanVolume } = design(units);
  const rows: Row[] = observations
    .filter(
      (o) =>
        o.reported &&
        !o.collection &&
        physical.get(o.code)?.matched &&
        total(o.votes) > 0 &&
        o.eligible! > 0,
    )
    .map((o) => {
      const u = physical.get(o.code)!,
        observed = vector(o.votes),
        previous = vector(u.votes);
      let h = 2166136261;
      for (const char of u.municipality)
        h = Math.imul(h ^ char.charCodeAt(0), 16777619);
      return {
        unit: u,
        x: features.get(u.code)!,
        y: [
          ...observed.map((x, p) => x - previous[p]),
          Math.log(
            clamp(
              total(o.votes) /
                ((total(u.votes) * o.eligible!) / u.baselineEligible),
              0.5,
              1.5,
            ),
          ),
        ],
        weight: total(o.votes) / meanVolume,
        fold: (h >>> 0) % 4,
      };
    });
  const weight = sum(rows.map((r) => r.weight)),
    effective = weight ? weight ** 2 / sum(rows.map((r) => r.weight ** 2)) : 0;
  const municipalities = new Set(rows.map((r) => r.unit.municipality)).size;
  const penalties: (number | null)[] = [null, 400, 100, 25, 5];
  const losses = penalties.map(() => 0),
    lossWeights = penalties.map(() => 0);
  const cv = rows.length >= 24 && municipalities >= 12;
  if (cv)
    for (let f = 0; f < 4; f++) {
      const train = rows.filter((r) => r.fold !== f),
        validation = rows.filter((r) => r.fold === f);
      if (!train.length || !validation.length) continue;
      for (let i = 0; i < penalties.length; i++) {
        const model = fit(train, features, penalties[i]);
        for (const r of validation) {
          const prediction = model.predict(r.unit);
          losses[i] +=
            (r.weight *
              sum(prediction.slice(0, 8).map((v, p) => Math.abs(v - r.y[p])))) /
            8;
          lossWeights[i] += r.weight;
        }
      }
    }
  const scores = losses.map((v, i) =>
    lossWeights[i] ? v / lossWeights[i] : Infinity,
  );
  let selected = 0;
  for (let i = 1; i < scores.length; i++)
    if (scores[i] < scores[selected] * 0.98) selected = i;
  const model = rows.length ? fit(rows, features, penalties[selected]) : null;
  // A one-district reference penalty measures actual covariate support.
  // Reusing the stronger prediction penalty would hide unsupported extrapolation.
  const diagnosticModel = rows.length ? fit(rows, features, 1) : null;
  const reported = new Set(
    observations.filter((o) => o.reported).map((o) => o.code),
  );
  let exposure = 0,
    extrapolated = 0;
  const disagreement = zeros(P);
  for (const u of physical.values())
    if (!reported.has(u.code)) {
      const volume = (total(u.votes) * u.eligible) / u.baselineEligible;
      exposure += volume;
      if (!diagnosticModel || diagnosticModel.leverage(u) > 1)
        extrapolated += volume;
      const prediction = selected ? model?.predict(u) : null;
      if (prediction) {
        // Compare two feasible compositions. Clipping in the national model
        // must not masquerade as disagreement when it is the selected fallback.
        const prior = vector(u.votes),
          shifted = prior.map((v, p) =>
            Math.max(0, v + nationalDelta[NOWCAST_PARTIES[p]]),
          ),
          denominator = sum(shifted);
        for (let p = 0; p < P; p++)
          disagreement[p] +=
            volume *
            (prediction[p] - (shifted[p] / denominator - prior[p])) *
            100;
      }
    }
  const clusters = new Map<
    string,
    { weight: number; error: number[]; turnout: number }
  >();
  // Leave a whole municipality out: in-sample local residuals understate uncertainty.
  if (cv)
    for (let f = 0; f < 4; f++) {
      const train = rows.filter((r) => r.fold !== f),
        validation = rows.filter((r) => r.fold === f);
      if (!train.length || !validation.length) continue;
      const held = fit(train, features, penalties[selected]);
      for (const r of validation) {
        const c = clusters.get(r.unit.municipality) ?? {
            weight: 0,
            error: zeros(P),
            turnout: 0,
          },
          prediction = held.predict(r.unit);
        c.weight += r.weight;
        for (let p = 0; p < P; p++)
          c.error[p] += r.weight * (r.y[p] - prediction[p]);
        c.turnout += r.weight * (r.y[P] - prediction[P]);
        clusters.set(r.unit.municipality, c);
      }
    }
  const record = (a: number[]) =>
    Object.fromEntries(NOWCAST_PARTIES.map((p, i) => [p, a[i]])) as Votes;
  const diagnostics: SwingDiagnostics = {
    estimator: selected ? "regularized-geographic" : "national",
    penalty: penalties[selected],
    effectiveDistricts: effective,
    municipalities,
    crossValidationMaePp: Number.isFinite(scores[selected])
      ? scores[selected] * 100
      : null,
    nationalCrossValidationMaePp: Number.isFinite(scores[0])
      ? scores[0] * 100
      : null,
    extrapolatedVoteShare: exposure ? extrapolated / exposure : 0,
    modelDisagreementPp: record(
      disagreement.map((v) => (exposure ? v / exposure : 0)),
    ),
    clusterResidualsPp: [...clusters.values()].map((c) =>
      record(c.error.map((v) => (v / c.weight) * 100)),
    ),
    turnoutResidualRms: clusters.size
      ? Math.sqrt(
          sum([...clusters.values()].map((c) => (c.turnout / c.weight) ** 2)) /
            clusters.size,
        )
      : 0,
  };
  return {
    diagnostics,
    predict: (u: BaselineUnit) => {
      if (!model || u.collection || selected === 0)
        return { delta: nationalDelta, turnoutRatio: null };
      const y = model.predict(u);
      return {
        delta: record(y.slice(0, P)),
        turnoutRatio: clamp(Math.exp(y[P]), 0.5, 1.5),
      };
    },
  };
}
