"use client";
import { Localize } from "@/components/localize";


import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { PartyMark } from "@/components/party-mark";
import type { MunicipalityMapModel } from "@/lib/data/geography";
import { formatDelta, formatNumber } from "@/lib/format";
import { PARTIES, PARTY_ORDER } from "@/lib/parties";
import type { PartyId } from "@/lib/data/elections/types";

type MapPartyId = Exclude<PartyId, "OTHER">;
type MapView = "SHARE" | "SWING" | "TURNOUT";

const MAP_PARTIES = PARTY_ORDER.filter((partyId): partyId is MapPartyId => partyId !== "OTHER");
const SCALE_STRENGTH = [0.14, 0.32, 0.5, 0.7, 0.92];
const SWING_COLORS = ["#a34b43", "#d5a29b", "#f1eee5", "#8fb7c5", "#1c5170"];

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

function partyMetric(
  area: MunicipalityMapModel["areas"][number],
  key: "shares" | "previousShares" | "swings",
  partyId: MapPartyId,
): number {
  const value = area[key][partyId];
  if (value === undefined) throw new Error(`Missing ${partyId} ${key} for ${area.code}`);
  return value;
}

function displayValue(value: number, view: MapView): string {
  return view === "SWING" ? `${formatDelta(value)} pp` : `${value.toFixed(2)}%`;
}

export function MunicipalityElectionMap({ model }: { model: MunicipalityMapModel }) {
  const defaultMunicipality = model.areas.find((area) => area.code === "0180") ?? model.areas[0];
  const [view, setView] = useState<MapView>("SHARE");
  const [partyId, setPartyId] = useState<MapPartyId>("S");
  const [selectedCode, setSelectedCode] = useState(defaultMunicipality.code);
  const selectedArea = resultFor(model, selectedCode);
  const selectedParty = PARTIES[partyId];
  const selectedValue = view === "TURNOUT"
    ? selectedArea.turnout
    : partyMetric(selectedArea, view === "SWING" ? "swings" : "shares", partyId);
  const nationalValue = view === "TURNOUT"
    ? model.nationalTurnout
    : view === "SWING"
      ? model.nationalSwings[partyId] ?? 0
      : model.nationalShares[partyId] ?? 0;
  const pluralityParty = PARTIES[selectedArea.winner];
  const metricDescription = view === "TURNOUT"
    ? "turnout"
    : view === "SWING"
      ? `${selectedParty.name} vote-share swing from 2018 to 2022`
      : `${selectedParty.name} vote share in 2022`;

  const scale = useMemo(() => {
    const values = model.areas
      .map((area) => view === "TURNOUT" ? area.turnout : partyMetric(area, view === "SWING" ? "swings" : "shares", partyId))
      .sort((left, right) => left - right);
    if (view === "SWING") {
      const maximum = Math.max(...values.map(Math.abs));
      return {
        thresholds: [-maximum, -maximum * 0.6, -maximum * 0.2, maximum * 0.2, maximum * 0.6, maximum],
        colors: SWING_COLORS,
        startLabel: "Decrease",
        endLabel: "Increase",
      };
    }
    return {
      thresholds: [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) => quantile(values, fraction)),
      colors: SCALE_STRENGTH.map((strength) => mixColor("#e9f0f4", view === "TURNOUT" ? "#1c5170" : selectedParty.color, strength)),
      startLabel: "Lower",
      endLabel: "Higher",
    };
  }, [model.areas, partyId, selectedParty.color, view]);

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

  const previousShare = partyMetric(selectedArea, "previousShares", partyId);
  const currentShare = partyMetric(selectedArea, "shares", partyId);

  return <Localize>{(
    <div className="election-map">
      <div className="election-map__controls">
        <div>
          <span className="mini-label">{view === "SWING" ? "Derived · municipality-swing v1.0.0" : "Official metric · Riksdag 2022"}</span>
          <h2>{view === "SWING" ? "Election swing by municipality" : view === "TURNOUT" ? "Turnout by municipality" : "Vote share by municipality"}</h2>
          <p>Select a view and party, then tap a municipality for exact official inputs and the transparent calculation.</p>
        </div>
        <div className="election-map__selectors">
          <div className="map-view-picker" aria-label="Choose map view">
            {(["SHARE", "SWING", "TURNOUT"] as const).map((candidate) => (
              <button aria-pressed={view === candidate} className={view === candidate ? "is-active" : ""} key={candidate} onClick={() => setView(candidate)} type="button">
                <strong>{candidate === "SHARE" ? "2022" : candidate === "SWING" ? "18→22" : "%"}</strong>
                <span>{candidate === "SHARE" ? "Vote share" : candidate === "SWING" ? "Swing" : "Turnout"}</span>
              </button>
            ))}
          </div>
          <div className={view === "TURNOUT" ? "election-map__party-picker is-muted" : "election-map__party-picker"} aria-label="Choose party">
            {MAP_PARTIES.map((candidateId) => {
              const party = PARTIES[candidateId];
              return (
                <button
                  aria-pressed={partyId === candidateId && view !== "TURNOUT"}
                  className={partyId === candidateId && view !== "TURNOUT" ? "map-party is-active" : "map-party"}
                  key={candidateId}
                  onClick={() => { setPartyId(candidateId); if (view === "TURNOUT") setView("SHARE"); }}
                  style={{ "--map-party": party.color } as CSSProperties}
                  type="button"
                >
                  <PartyMark party={party} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="election-map__workspace">
        <div className="election-map__canvas">
          <div className="map-scale" aria-label={`${metricDescription} scale`}>
            <span>{scale.startLabel}</span>
            <div>{scale.colors.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} title={`${scale.thresholds[index].toFixed(2)} to ${scale.thresholds[index + 1].toFixed(2)}${view === "SWING" ? " pp" : "%"}`} />)}</div>
            <span>{scale.endLabel}</span>
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
              const value = view === "TURNOUT" ? area.turnout : partyMetric(area, view === "SWING" ? "swings" : "shares", partyId);
              const selected = area.code === selectedCode;
              return (
                <path
                  aria-label={`${area.name}: ${displayValue(value, view)} ${metricDescription}`}
                  aria-selected={selected}
                  className={selected ? "municipality-shape is-selected" : "municipality-shape"}
                  d={area.path}
                  fill={colorFor(value)}
                  id={`municipality-map-${area.code}`}
                  key={area.code}
                  onClick={() => setSelectedCode(area.code)}
                  role="option"
                >
                  <title>{`${area.name}: ${displayValue(value, view)} ${metricDescription}`}</title>
                </path>
              );
            })}
          </svg>
          <p className="map-scale__note">{view === "SWING" ? "A neutral diverging scale shows percentage-point decrease and increase. Swing is 2022 share minus the comparable 2018 share." : "Five equal-sized municipality groups. Color intensity is relative; every selected value is exact."}</p>
        </div>

        <aside className="municipality-detail" aria-live="polite">
          <label className="municipality-picker">
            <span className="mini-label">Selected municipality</span>
            <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
              {model.areas.map((area) => <option key={area.code} value={area.code}>{area.name}</option>)}
            </select>
          </label>

          <div className="municipality-detail__headline">
            {view === "TURNOUT" ? <span className="map-metric-mark" aria-hidden="true">%</span> : <PartyMark party={selectedParty} size="lg" />}
            <div><span>{view === "SWING" ? `${selectedParty.name} swing` : view === "TURNOUT" ? "Turnout 2022" : `${selectedParty.name} 2022`}</span><strong>{displayValue(selectedValue, view)}</strong></div>
          </div>

          <dl className="municipality-detail__metrics">
            {view === "SWING" ? <>
              <div><dt>2018 vote share</dt><dd>{previousShare.toFixed(2)}% <small>OFFICIAL</small></dd></div>
              <div><dt>2022 vote share</dt><dd>{currentShare.toFixed(2)}% <small>OFFICIAL</small></dd></div>
              <div><dt>National swing</dt><dd>{formatDelta(nationalValue)} pp <small>DERIVED</small></dd></div>
              <div><dt>Against national swing</dt><dd>{formatDelta(selectedValue - nationalValue)} pp <small>DERIVED</small></dd></div>
            </> : view === "TURNOUT" ? <>
              <div><dt>2018 turnout</dt><dd>{selectedArea.previousTurnout.toFixed(2)}% <small>OFFICIAL</small></dd></div>
              <div><dt>Turnout change</dt><dd>{formatDelta(selectedArea.turnoutChange)} pp <small>DERIVED</small></dd></div>
              <div><dt>Ballots cast 2022</dt><dd>{formatNumber(selectedArea.totalVotes)} <small>OFFICIAL</small></dd></div>
              <div><dt>National turnout change</dt><dd>{formatDelta(model.nationalTurnoutChange)} pp <small>DERIVED</small></dd></div>
            </> : <>
              <div><dt>2018 vote share</dt><dd>{previousShare.toFixed(2)}% <small>OFFICIAL</small></dd></div>
              <div><dt>Change since 2018</dt><dd>{formatDelta(partyMetric(selectedArea, "swings", partyId))} pp <small>DERIVED</small></dd></div>
              <div><dt>Against national</dt><dd>{formatDelta(selectedValue - nationalValue)} pp <small>DERIVED</small></dd></div>
              <div><dt>Valid votes 2022</dt><dd>{formatNumber(selectedArea.validVotes)} <small>OFFICIAL</small></dd></div>
            </>}
          </dl>

          <p className="municipality-detail__note">Riksdag ballots in {selectedArea.name}. Plurality party in 2022: <PartyMark party={pluralityParty} size="inline" />. This is not the municipal council election.</p>
          <div className="map-source-links">
            <a className="map-source-link" href={model.source.results2018.sourceUrl} rel="noreferrer" target="_blank">2018 official results <span>↗</span></a>
            <a className="map-source-link" href={model.source.results2022.sourceUrl} rel="noreferrer" target="_blank">2022 official results <span>↗</span></a>
            <a className="map-source-link" href={model.source.geometry.sourceUrl} rel="noreferrer" target="_blank">2022 official geometry <span>↗</span></a>
            <a className="map-source-link" href={model.source.comparison.basisUrl} rel="noreferrer" target="_blank">Comparability basis <span>↗</span></a>
          </div>
        </aside>
      </div>
    </div>
  )}</Localize>;
}
