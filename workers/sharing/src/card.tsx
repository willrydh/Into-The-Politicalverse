import { rankingLabel } from "../../../lib/candidates/leaderboards";
import type { ShareStandingHighlights } from "../../../lib/candidates/sharing-standings";
import satori, { init } from "satori/standalone";
import yoga from "satori/yoga.wasm";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvg from "@resvg/resvg-wasm/index_bg.wasm";
import regular from "@fontsource/inter/files/inter-latin-400-normal.woff";
import bold from "@fontsource/inter/files/inter-latin-700-normal.woff";
import extended from "@fontsource/inter/files/inter-latin-ext-400-normal.woff";
import extendedBold from "@fontsource/inter/files/inter-latin-ext-700-normal.woff";
import crown from "../../../public/brand/crown-2026/politicalverse-logo.svg";
import { compactCandidateNumber } from "../../../lib/candidates/format";
import { electionShareLabel, shareNumber, sharePercent, shareReason, type ShareLocale, type SharePerson, type ShareScope } from "../../../lib/candidates/sharing";

// Only immutable rendering resources are shared across requests; never candidate state.
let ready: Promise<unknown> | undefined;
const muted = "#a9c2ce", ink = "#f8fafb", accent = "#ffd145";

export async function renderCard(person: SharePerson, scope: ShareScope, locale: ShareLocale, standings: ShareStandingHighlights) {
  await (ready ??= Promise.all([init(yoga), initWasm(resvg)]));
  const sv = locale === "sv";
  const percent = scope.percent !== null && Math.abs(scope.percent) >= 10_000
    ? `${scope.percent < 0 ? "−" : "+"}${compactCandidateNumber(Math.abs(scope.percent), sv)} %` : sharePercent(scope, locale);
  const changeColor = scope.percent === null || scope.percent === 0 ? ink : scope.percent > 0 ? "#a7dcbd" : "#f5a8b8";
  const ranked = standings.items.length > 0;
  const oneMetric = ranked && standings.items.every(item => item.metric === standings.items[0].metric);
  // Lead with exact/high placements; keep broader top-100 mentions on the right.
  // At most three entries per column, including profiles with only one rank tier.
  const orderedRanks = [...standings.items.filter(item => item.rank <= 50), ...standings.items.filter(item => item.rank > 50)];
  const exactCount = orderedRanks.filter(item => item.rank <= 50).length;
  const splitAt = exactCount > 0 && exactCount <= 3 && orderedRanks.length - exactCount <= 3
    ? exactCount : Math.ceil(orderedRanks.length / 2);
  const rankColumns = [orderedRanks.slice(0, splitAt), orderedRanks.slice(splitAt)];
  const history = scope.history.slice(-8);
  const max = Math.max(1, ...history.map(p => p.votes ?? 0));
  const graphWidth = ranked ? 280 : 1060;
  const x = (i: number) => history.length === 1 ? graphWidth / 2 : 18 + i * ((graphWidth - 36) / (history.length - 1));
  const y = (votes: number) => 78 - votes / max * 62;
  const fullPartyChange = scope.previousParty && scope.previousParty !== scope.party ? `${scope.previousParty} ${sv ? "till" : "to"} ${scope.party}` : null;
  const partyChange = fullPartyChange && fullPartyChange.length > 20 ? (sv ? "Partibyte" : "Party change") : fullPartyChange;
  const title = `${person.name} (${scope.party})`;
  const graph = <div style={{ display: "flex", flexDirection: "column", width: graphWidth, marginTop: ranked ? 0 : 20 }}>
    <svg width={graphWidth} height={ranked ? 65 : 92} viewBox={`0 0 ${graphWidth} 92`} preserveAspectRatio="none">
      <line x1="18" y1="78" x2={graphWidth - 18} y2="78" stroke="#395868" strokeWidth="1" />
      {history.map((point, i) => point.votes !== null && <g key={point.year}>
        {i > 0 && point.connect && history[i - 1].votes !== null && <line x1={x(i - 1)} y1={y(history[i - 1].votes!)} x2={x(i)} y2={y(point.votes)} stroke={accent} strokeWidth="3" />}
        <circle cx={x(i)} cy={y(point.votes)} r="5" fill={accent} />
      </g>)}
    </svg>
    <div style={{ display: "flex", justifyContent: history.length === 1 ? "center" : "space-between", width: graphWidth }}>
      {history.map((point, i) => (!ranked || i === 0 || i === history.length - 1) && <div key={point.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", fontSize: ranked ? 14 : 17, color: muted }}>
        <span>{point.year} {point.party.length <= 3 ? point.party : ""}</span>
        {!ranked && <span style={{ marginTop: 3, color: ink }}>{point.votes === null ? "—" : shareNumber(point.votes, locale)}</span>}
      </div>)}
    </div>
  </div>;
  const svg = await satori(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#0c2d40", color: ink, fontFamily: "Inter, InterExtended", padding: ranked ? "28px 64px 24px" : "38px 64px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: ranked ? 52 : 62 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Exact owner-supplied artwork, embedded without external requests. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${Buffer.from(crown).toString("base64")}`} width={58} height={58} alt="" />
          <span style={{ fontWeight: 700, fontSize: 27 }}>Politicalverse</span>
        </div>
        <span style={{ color: muted, fontSize: 22 }}>{sv ? "Personröster" : "Personal votes"} · {scope.year}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: ranked ? 105 : 147, flexShrink: 0 }}>
        <div style={{ fontSize: title.length > 180 ? 24 : title.length > 120 ? 30 : title.length > 68 ? 35 : title.length > 42 ? 45 : ranked ? 50 : 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.6 }}>{title}</div>
        <div style={{ fontSize: scope.areaName.length > 52 ? 22 : 26, color: muted, marginTop: 13 }}>{`${electionShareLabel(scope, locale)} · ${scope.areaName}`}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", height: ranked ? 100 : 128, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", width: ranked ? 285 : 410 }}>
          <span style={{ fontSize: ranked ? 64 : 76, fontWeight: 700, letterSpacing: -2 }}>{shareNumber(scope.votes, locale)}</span>
          <span style={{ fontSize: 22, color: muted }}>{sv ? "personröster" : "personal votes"}</span>
        </div>
        <div style={{ width: 1, height: 84, backgroundColor: "#395868", marginRight: ranked ? 32 : 54 }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontSize: ranked ? 58 : 72, fontWeight: 700, color: changeColor, letterSpacing: -2 }}>{percent}</span>
          <span style={{ fontSize: ranked ? 17 : scope.percent === null ? 18 : 22, color: muted }}>{scope.percent === null ? shareReason(scope.reason, locale) : `${sv ? "sedan" : "since"} ${scope.year - 4}${partyChange ? ` · ${partyChange}` : ""}`}</span>
        </div>
        {ranked && graph}
      </div>
      {ranked ? <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 11, fontSize: 17, color: muted }}>
          <span>{oneMetric ? rankingLabel(standings.items[0].metric, sv) : sv ? "I topplistorna" : "On the leaderboards"} · {standings.year}</span>
          <span>{standings.total > 5 ? (sv ? "Utvalda placeringar" : "Selected rankings") : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 36 }}>
          {rankColumns.map((column, i) => <div key={i} style={{ display: "flex", flexDirection: "column", width: 518 }}>
            {column.map(item => <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 16, height: 78, borderTop: "1px solid #254656" }}>
              <div style={{ display: "flex", width: 108, flexShrink: 0, fontSize: item.placement.startsWith("#") ? 32 : 22, fontWeight: 700 }}>{item.placement}</div>
              <div style={{ display: "flex", width: 394, minWidth: 0, flexDirection: "column", gap: 5 }}>
                {!oneMetric && <div style={{ fontSize: 20, lineHeight: 1.1, fontWeight: 400 }}>{item.label}</div>}
                <div style={{ fontSize: oneMetric ? 20 : 16, lineHeight: 1.25, color: muted }}>{item.detail}</div>
              </div>
            </div>)}
          </div>)}
        </div>
      </div> : graph}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", fontSize: ranked ? 14 : 16, color: muted }}>
        <span>{sv ? `Slutresultat: Valmyndigheten · ${ranked ? "Placeringar och förändring: beräknade" : "Förändring: beräknad"}` : `Final results: Valmyndigheten · ${ranked ? "Rankings and change: calculated" : "Change: calculated"}`}</span>
        <span style={{ color: ink, fontSize: 20 }}>politicalverse.se</span>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [{ name: "Inter", data: regular, weight: 400 }, { name: "Inter", data: bold, weight: 700 }, { name: "InterExtended", data: extended, weight: 400 }, { name: "InterExtended", data: extendedBold, weight: 700 }] },
  );
  const renderer = new Resvg(svg, { font: { loadSystemFonts: false } });
  try {
    const image = renderer.render();
    try { return image.asPng(); } finally { image.free(); }
  } finally { renderer.free(); }
}
