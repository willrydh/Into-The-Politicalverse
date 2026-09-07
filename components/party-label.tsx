"use client";
import { Fragment } from "react";
import { PartyMark } from "./party-mark";
import { useLocale } from "./localize";
import { PARTIES } from "@/lib/parties";
import type { PartyId } from "@/lib/data/elections/types";
import { partyDisplayName, partyShortName, splitPartyText } from "@/lib/party-labels";
import { translateText } from "@/lib/i18n/translate";

export function PartyAbbreviation({ partyId, year }: { partyId: PartyId; year?: number }) {
  const name = translateText(partyDisplayName(partyId, year), useLocale());
  if (partyId === "OTHER") return <>{name}</>;
  return <abbr className="party-abbreviation" title={name}>{partyShortName(partyId, year)}</abbr>;
}

/** Text suits compact comparisons; dedicated identity panels can opt into logos. */
export function PartyGroup({ parties, year, variant = "text" }: { parties: readonly PartyId[]; year?: number; variant?: "text" | "logos" }) {
  return <span className={`party-group party-group--${variant}`}>{parties.map((id, i) => <Fragment key={`${id}-${i}`}>
    {i > 0 && <span className="party-group__separator" aria-hidden={variant === "logos" || undefined}>{" + "}</span>}
    {variant === "logos"
      ? <PartyMark party={PARTIES[id]} label={partyDisplayName(id, year)} size="sm" />
      : <PartyAbbreviation partyId={id} year={year} />}
  </Fragment>)}</span>;
}

/** Keep prose as readable text, translating the whole sentence before annotating abbreviations. */
export function PartyText({ children }: { children: string }) {
  const text = translateText(children, useLocale());
  return <>{splitPartyText(text).map((part, index) => part.partyId
    ? <PartyAbbreviation key={index} partyId={part.partyId} year={part.historical ? 2014 : undefined} />
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}

export function PartySvgLabel({ partyId, x, y, year }: { partyId: PartyId; x: number; y: number; year?: number }) {
  const name = translateText(partyDisplayName(partyId, year), useLocale());
  return <text className="party-svg-label" x={x} y={y} dominantBaseline="middle" aria-label={name}>
    <title>{name}</title>{partyId === "OTHER" ? name : partyShortName(partyId, year)}
  </text>;
}
