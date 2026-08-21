import Image from "next/image";
import type { CSSProperties } from "react";
import type { PartyDefinition } from "@/lib/parties";

type PartyMarkProps = {
  party: PartyDefinition;
  size?: "sm" | "md" | "lg";
};

export function PartyMark({ party, size = "md" }: PartyMarkProps) {
  const style = { "--party": party.color, "--party-text": party.textColor } as CSSProperties;

  return (
    <span className={`party-mark party-mark--${size}`} style={style} title={party.name}>
      {party.logo ? (
        <Image src={party.logo} alt={`${party.name} logo`} width={72} height={72} />
      ) : (
        <span className="party-mark__fallback" aria-hidden="true">{party.shortName}</span>
      )}
    </span>
  );
}
