"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { PartyMark } from "@/components/party-mark";
import type { MunicipalityMapModel } from "@/lib/data/geography";
import { formatDelta, formatNumber } from "@/lib/format";
import { PARTIES, PARTY_ORDER } from "@/lib/parties";
import type { PartyId } from "@/lib/data/elections/types";

type MapPartyId = Exclude<PartyId, "OTHER">;
type MapMetric = MapPartyId | "TURNOUT";

const MAP_PARTIES = PARTY_ORDER.filter((partyId): partyId is MapPartyId => partyId !== "OTHER");
const SCALE_STRENGTH = [0.14, 0.32, 0.5, 0.7, 0.92];

function component(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16);
}

function mixColor(background: string, foreground: string, strength: number): string {
  const red = Math.round(component(background, 1) * (1 - strength) + component(foreground, 1) * strength);
  const green = Math.round(component(background, 3) * (1 - strength) + component(foreground, 3) * strength);
  const blue = Math.round(component(background, 5) * (1 - strength) + component(foreground, 5) * strength);
  return `rgb(${red} ${green} ${blue})`;
}

function quantile(sortedValues: number[], fraction: number): number {
  const index = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(index);
  const remainder = index - lower;
  return sortedValues[lower + 1] === undefined
    ? sortedValues[lower]
    : sortedValues[lower] + remainder * (sortedValues[lower + 1] - sortedValues[lower]);
}

function resultFor(model: MunicipalityMapModel, code: string) {
  const area = model.areas.find((candidate) => candidate.code === code);
  if (!area) throw new Error(`Unknown municipality ${code}`);
  return area;
}

function shareFor(area: MunicipalityMapModel["areas"][number], partyId: MapPartyId): number {
  const share = area.shares[partyId];
  if (share === undefined) throw new Error(`Missing ${partyId} share for ${area.code}`);
  return share;
}

export function MunicipalityElectionMap({ model }: { model: MunicipalityMapModel }) {
  const defaultMunicipality = model.areas.find((area) => area.code === "0180") ?? model.areas[0];
  const [metric, setMetric] = useState<MapMetric>("S");
  const [selectedCode, setSelectedCode] = useState(defaultMunicipality.code);
  const selectedArea = resultFor(model, selectedCode);
  const selectedParty = metric === "TURNOUT" ? null : PARTIES[metric];
  const selectedValue = metric === "TURNOUT" ? selectedArea.turnout : shareFor(selectedArea, metric);
  const nationalValue = metric === "TURNOUT" ? model.nationalTurnout : model.nationalShares[metric] ?? 0;
  const metricName = selectedParty?.name ?? "Turnout";
  const metricDescription = selectedParty ? `${selectedParty.name} vote share` : "turnout";
  const metricColor = selectedParty?.color ?? "#1c5170";
  const pluralityParty = PARTIES[selectedArea.winner];

  const scale = useMemo(() => {
    const values = model.areas.map((area) => metric === "TURNOUT" ? area.turnout : shareFor(area, metric)).sort((left, right) => left - right);
    const thresholds = [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) => quantile(values, fraction));
    const colors = SCALE_STRENGTH.map((strength) => mixColor("#e9f0f4", metricColor, strength));
    return { thresholds, colors };
  }, [metric, metricColor, model.areas]);

  function colorFor(value: number): string {
    const thresholdIndex = scale.thresholds.slice(1, -1).findIndex((threshold) => value <= threshold);
    return scale.colors[thresholdIndex === -1 ? scale.colors.length - 1 : thresholdIndex];
  }

  function selectByKeyboard(event: KeyboardEvent<SVGSVGElement>): void {
    const currentIndex = model.areas.findIndex((area) => area.code === selectedCode);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % model.areas.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + model.areas.length) % model.areas.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = model.areas.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    setSelectedCode(model.areas[nextIndex].code);
  }

  return (
    <div className="election-map">
      <div className="election-map__controls">
        <div>
          <span className="mini-label">Official metric · Riksdag 2022</span>
          <h2>{metric === "TURNOUT" ? "Turnout by municipality" : "Vote share by municipality"}</h2>
          <p>Select a metric, then tap a municipality for its exact final result.</p>
        </div>
        <div className="election-map__metric-picker">
          <div className="election-map__party-picker" aria-label="Choose party vote share">
            {MAP_PARTIES.map((candidateId) => {
              const party = PARTIES[candidateId];
              return (
                <button
                  aria-pressed={metric === candidateId}
                  className={metric === candidateId ? "map-party is-active" : "map-party"}
                  key={candidateId}
                  onClick={() => setMetric(candidateId)}
                  style={{ "--map-party": party.color } as CSSProperties}
                  type="button"
                >
                  <PartyMark party={party} size="sm" />
                  <span>{party.shortName}</span>
                </button>
              );
            })}
          </div>
          <button aria-pressed={metric === "TURNOUT"} className={metric === "TURNOUT" ? "map-turnout is-active" : "map-turnout"} onClick={() => setMetric("TURNOUT")} type="button">
            <strong>%</strong><span>Turnout</span>
          </button>
        </div>
      </div>

      <div className="election-map__workspace">
        <div className="election-map__canvas">
          <div className="map-scale" aria-label={`Relative ${metricDescription} scale`}>
            <span>Lower</span>
            <div>{scale.colors.map((color, index) => <i key={color} style={{ background: color }} title={`${scale.thresholds[index].toFixed(1)}–${scale.thresholds[index + 1].toFixed(1)}%`} />)}</div>
            <span>Higher</span>
          </div>
          <svg
            aria-activedescendant={`municipality-map-${selectedCode}`}
            aria-label={`Map of 290 municipalities showing ${metricDescription}. Use arrow keys to move through municipalities.`}
            className="municipality-map"
            onKeyDown={selectByKeyboard}
            role="listbox"
            tabIndex={0}
            viewBox={model.viewBox}
          >
            {model.areas.map((area) => {
              const value = metric === "TURNOUT" ? area.turnout : shareFor(area, metric);
              const selected = area.code === selectedCode;
              return (
                <path
                  aria-label={`${area.name}: ${value.toFixed(2)} percent ${metric === "TURNOUT" ? "turnout" : metric}`}
                  aria-selected={selected}
                  className={selected ? "municipality-shape is-selected" : "municipality-shape"}
                  d={area.path}
                  fill={colorFor(value)}
                  id={`municipality-map-${area.code}`}
                  key={area.code}
                  onClick={() => setSelectedCode(area.code)}
                  role="option"
                >
                  <title>{`${area.name}: ${value.toFixed(2)}% ${metricName}`}</title>
                </path>
              );
            })}
          </svg>
          <p className="map-scale__note">Five equal-sized municipality groups. Color intensity is a relative visual scale; the selected value is exact.</p>
        </div>

        <aside className="municipality-detail" aria-live="polite">
          <label className="municipality-picker">
            <span className="mini-label">Selected municipality</span>
            <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
              {model.areas.map((area) => <option key={area.code} value={area.code}>{area.name}</option>)}
            </select>
          </label>

          <div className="municipality-detail__headline">
            {selectedParty ? <PartyMark party={selectedParty} size="lg" /> : <span className="map-metric-mark" aria-hidden="true">%</span>}
            <div><span>{metricName}</span><strong>{selectedValue.toFixed(2)}%</strong></div>
          </div>

          <dl className="municipality-detail__metrics">
            <div><dt>Against national</dt><dd>{formatDelta(selectedValue - nationalValue)} pp <small>DERIVED</small></dd></div>
            <div><dt>{metric === "TURNOUT" ? "Ballots cast" : "Turnout"}</dt><dd>{metric === "TURNOUT" ? formatNumber(selectedArea.totalVotes) : `${selectedArea.turnout.toFixed(2)}%`} <small>OFFICIAL</small></dd></div>
            <div><dt>Valid votes</dt><dd>{formatNumber(selectedArea.validVotes)} <small>OFFICIAL</small></dd></div>
            <div><dt>Plurality party</dt><dd><span className="detail-party-dot" style={{ background: pluralityParty.color }} />{pluralityParty.shortName} <small>OFFICIAL</small></dd></div>
          </dl>

          <p className="municipality-detail__note">Riksdag ballots cast in {selectedArea.name}; this is not the result of the municipal council election.</p>
          <a className="map-source-link" href={model.source.sourceUrl} rel="noreferrer" target="_blank">Valmyndigheten source and GIS files <span>↗</span></a>
        </aside>
      </div>
    </div>
  );
}
