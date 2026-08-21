import { getMunicipalityLeaders, riksdag2022 } from "@/lib/data/elections";
import { PARTIES } from "@/lib/data/elections/parties";

export function GeographicBreadth() {
  const leaders = getMunicipalityLeaders();
  const topTurnout = [...riksdag2022.municipalities].sort((a, b) => b.turnout - a.turnout).slice(0, 5);

  return (
    <div className="geography-card">
      <div className="geography-card__visual">
        <div className="geography-card__topline">
          <span>Municipality plurality leader</span>
          <span>290 municipalities</span>
        </div>
        <div className="breadth-bar" aria-label="Municipality plurality leaders">
          {leaders.map((leader) => (
            <span
              key={leader.partyId}
              style={{ background: PARTIES[leader.partyId].color, width: `${leader.share}%` }}
              title={`${PARTIES[leader.partyId].name}: ${leader.count} municipalities`}
            />
          ))}
        </div>
        <div className="breadth-legend">
          {leaders.map((leader) => (
            <div key={leader.partyId}>
              <span style={{ background: PARTIES[leader.partyId].color }} />
              <strong>{PARTIES[leader.partyId].shortName}</strong>
              <b>{leader.count}</b>
              <small>{leader.share}%</small>
            </div>
          ))}
        </div>
        <p className="geography-note">Based on final 2022 Riksdag votes, aggregated from 6,578 reporting districts. This is a geographic vote measure, not municipal council control.</p>
      </div>
      <div className="turnout-ranking">
        <div className="turnout-ranking__header">
          <span className="mini-label">Participation</span>
          <h3>Highest turnout</h3>
        </div>
        <ol>
          {topTurnout.map((area, index) => (
            <li key={area.code}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{area.name}</strong>
              <b>{area.turnout.toFixed(2)}%</b>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
