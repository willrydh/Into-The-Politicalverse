"use client";

import { useState, type CSSProperties } from "react";
import { PartyMark } from "@/components/party-mark";
import { PARTIES } from "@/lib/data/elections/parties";
import type { PartyProfile } from "@/lib/data/elections";
import type { PartyId } from "@/lib/data/elections/types";
import { formatDelta, formatNumber } from "@/lib/format";

export function PartyExplorer({ profiles }: { profiles: PartyProfile[] }) {
  const [selected, setSelected] = useState<PartyId>("S");
  const profile = profiles.find((item) => item.partyId === selected) ?? profiles[0];
  const party = PARTIES[profile.partyId];
  const maxShare = Math.max(...profile.history.map((point) => point.share));

  return (
    <div className="party-explorer">
      <div className="party-explorer__rail" aria-label="Choose party">
        {profiles.map((item) => {
          const itemParty = PARTIES[item.partyId];
          return (
            <button
              key={item.partyId}
              className={item.partyId === selected ? "party-choice is-active" : "party-choice"}
              onClick={() => setSelected(item.partyId)}
              type="button"
              aria-pressed={item.partyId === selected}
            >
              <PartyMark party={itemParty} size="md" />
              <strong>{itemParty.name}</strong>
              <b>{item.current.share.toFixed(2)}%</b>
            </button>
          );
        })}
      </div>
      <div className="party-explorer__detail" style={{ "--party-color": party.color } as CSSProperties}>
        <div className="party-detail__header">
          <PartyMark party={party} size="lg" />
          <div><span className="mini-label">Party explorer · National</span><h2>{party.name}</h2></div>
          <div className="party-detail__headline"><strong>{profile.current.share.toFixed(2)}%</strong><span className={profile.change >= 0 ? "delta delta--up" : "delta delta--down"}>{formatDelta(profile.change)} pp</span></div>
        </div>
        <div className="party-history-bars" aria-label={`${party.name} national vote share by election`}>
          {profile.history.map((point) => (
            <div className="party-history-bar" key={point.year}>
              <span>{point.year}</span>
              <div><i style={{ height: `${Math.max(4, (point.share / maxShare) * 100)}%`, background: party.color }} /></div>
              <strong>{point.share.toFixed(2)}</strong>
            </div>
          ))}
        </div>
        <div className="party-geography">
          <div>
            <span className="mini-label">Strongest municipalities</span>
            {profile.strongestMunicipalities.map((area, index) => <p key={area.name}><span>{index + 1}</span><strong>{area.name}</strong><b>{area.share.toFixed(2)}%</b></p>)}
          </div>
          <div>
            <span className="mini-label">Lowest vote share</span>
            {profile.weakestMunicipalities.map((area, index) => <p key={area.name}><span>{index + 1}</span><strong>{area.name}</strong><b>{area.share.toFixed(2)}%</b></p>)}
          </div>
        </div>
        <div className="party-detail__footer"><span>{formatNumber(profile.current.votes)} votes</span><span>{profile.current.seats} seats</span><span>Final 2022 result</span></div>
      </div>
    </div>
  );
}
