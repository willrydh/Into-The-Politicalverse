import { Party } from "@/lib/parties";

type Props = { party: Party; size?: "sm" | "md" | "lg" };

export function PartyMark({ party, size = "md" }: Props) {
  return (
    <span className={`partyMark partyMark--${size}`} style={{ "--party": party.color } as React.CSSProperties} title={party.name}>
      <img src={party.logo} alt={`${party.name} logo`} />
      <span className="partyMarkFallback" aria-hidden="true">{party.shortName}</span>
    </span>
  );
}