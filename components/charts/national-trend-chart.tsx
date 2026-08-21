"use client";

import { useState } from "react";
import { PARTIES, PARTY_ORDER } from "@/lib/data/elections/parties";
import type { NationalHistoryData, PartyId } from "@/lib/data/elections/types";

type NationalTrendChartProps = {
  history: NationalHistoryData;
  initialParty?: PartyId | null;
  compact?: boolean;
};

const WIDTH = 900;
const HEIGHT = 430;
const MARGIN = { top: 25, right: 76, bottom: 48, left: 48 };
const MAX_SHARE = 40;
const END_LABEL_OFFSETS: Partial<Record<PartyId, number>> = {
  V: -17,
  C: -5,
  KD: -4,
  MP: 6,
  L: 17,
};

function xPosition(index: number, length: number): number {
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  return MARGIN.left + (index * plotWidth) / Math.max(1, length - 1);
}

function yPosition(share: number): number {
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  return MARGIN.top + plotHeight - (share / MAX_SHARE) * plotHeight;
}

function linePath(points: { year: number; share: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${xPosition(index, points.length)} ${yPosition(point.share)}`).join(" ");
}

export function NationalTrendChart({ history, initialParty = null, compact = false }: NationalTrendChartProps) {
  const [activeParty, setActiveParty] = useState<PartyId | null>(initialParty);
  const partyOrder = PARTY_ORDER.filter((partyId) => partyId !== "OTHER");

  const series = partyOrder.map((partyId) => ({
    partyId,
    points: history.elections.map((election) => ({
      year: election.year,
      share: election.parties.find((party) => party.partyId === partyId)?.share ?? 0,
    })),
  }));

  return (
    <div className={compact ? "trend-chart trend-chart--compact" : "trend-chart"}>
      <div className="chart-controls" aria-label="Select a party to highlight">
        <button className={activeParty === null ? "party-filter is-active" : "party-filter"} onClick={() => setActiveParty(null)} type="button">
          All
        </button>
        {partyOrder.map((partyId) => (
          <button
            className={activeParty === partyId ? "party-filter is-active" : "party-filter"}
            key={partyId}
            onClick={() => setActiveParty((current) => current === partyId ? null : partyId)}
            onMouseEnter={() => setActiveParty(partyId)}
            onFocus={() => setActiveParty(partyId)}
            type="button"
            aria-pressed={activeParty === partyId}
          >
            <span style={{ background: PARTIES[partyId].color }} />
            {PARTIES[partyId].shortName}
          </button>
        ))}
      </div>
      <div className="chart-scroll" tabIndex={0} aria-label="Scrollable chart area">
        <svg className="line-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby="trend-title trend-description">
          <title id="trend-title">Swedish Riksdag election vote share by party, 2002 to 2022</title>
          <desc id="trend-description">Official final national vote shares from Valmyndigheten. Select a party above to highlight its history.</desc>
          <g className="chart-grid">
            {[0, 10, 20, 30, 40].map((tick) => (
              <g key={tick}>
                <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yPosition(tick)} y2={yPosition(tick)} />
                <text x={MARGIN.left - 11} y={yPosition(tick) + 4} textAnchor="end">{tick}%</text>
              </g>
            ))}
            {history.elections.map((election, index) => (
              <g key={election.year}>
                <line className="chart-grid__vertical" x1={xPosition(index, history.elections.length)} x2={xPosition(index, history.elections.length)} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} />
                <text className="chart-year" x={xPosition(index, history.elections.length)} y={HEIGHT - 17} textAnchor="middle">{election.year}</text>
              </g>
            ))}
          </g>
          {series.map(({ partyId, points }) => {
            const party = PARTIES[partyId];
            const muted = activeParty !== null && activeParty !== partyId;
            const lastPoint = points.at(-1)!;
            const labelOffset = END_LABEL_OFFSETS[partyId] ?? 0;
            const lastX = xPosition(points.length - 1, points.length);
            const lastY = yPosition(lastPoint.share);
            return (
              <g
                className={muted ? "party-line is-muted" : activeParty === partyId ? "party-line is-active" : "party-line"}
                key={partyId}
                onMouseEnter={() => setActiveParty(partyId)}
                onMouseLeave={() => setActiveParty(initialParty)}
              >
                <path d={linePath(points)} stroke={party.color} />
                {points.map((point, index) => (
                  <circle
                    key={point.year}
                    cx={xPosition(index, points.length)}
                    cy={yPosition(point.share)}
                    r={activeParty === partyId ? 5 : 3.5}
                    fill={party.color}
                    tabIndex={0}
                    onFocus={() => setActiveParty(partyId)}
                  >
                    <title>{`${party.name}, ${point.year}: ${point.share.toFixed(2)}%`}</title>
                  </circle>
                ))}
                {labelOffset !== 0 ? (
                  <line className="party-line__leader" x1={lastX + 4} y1={lastY} x2={lastX + 9} y2={lastY + labelOffset} stroke={party.color} />
                ) : null}
                <text
                  className="party-line__label"
                  x={lastX + 11}
                  y={lastY + labelOffset + 4}
                  fill={party.color}
                >
                  {party.shortName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="chart-caption">
        <span>Share of valid votes</span>
        <span>Final results · Riksdag</span>
      </div>
    </div>
  );
}
