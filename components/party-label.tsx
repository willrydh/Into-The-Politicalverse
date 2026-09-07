"use client";
import { Fragment } from "react";
import { PartyMark } from "./party-mark";
import { useLocale } from "./localize";
import { PARTIES } from "@/lib/parties";
import type { PartyId } from "@/lib/data/elections/types";
import { partyDisplayName, splitPartyText } from "@/lib/party-labels";
import { translateText } from "@/lib/i18n/translate";

export function PartyGroup({ parties, year }: { parties: readonly PartyId[]; year?: number }) {
  return <span className="party-group">{parties.map((id, i) => <Fragment key={`${id}-${i}`}>
    {i > 0 && <span className="party-group__separator" aria-hidden="true">+</span>}
    <PartyMark party={PARTIES[id]} label={partyDisplayName(id, year)} size="sm" />
  </Fragment>)}</span>;
}

/** Translate the complete sentence before replacing its party abbreviations. */
export function PartyText({ children }: { children: string }) {
  const text = translateText(children, useLocale());
  return <>{splitPartyText(text).map((part, index) => part.partyId
    ? <PartyMark key={index} party={PARTIES[part.partyId]} label={partyDisplayName(part.partyId, part.historical ? 2014 : undefined)} size="inline" />
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}

export function PartySvgMark({ partyId, x, y, size = 24 }: { partyId: PartyId; x: number; y: number; size?: number }) {
  const name = translateText(PARTIES[partyId].name, useLocale());
  const logo = PARTIES[partyId].logo;
  if (!logo) return <text x={x} y={y}>{name}</text>;
  return <g className="party-svg-mark" role="img" aria-label={name}>
    <title>{name}</title>
    <circle cx={x + size / 2} cy={y + size / 2} r={size / 2} fill="#fff" stroke="#d7dce0" />
    <image href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${logo}`} x={x + size * .11} y={y + size * .11} width={size * .78} height={size * .78} preserveAspectRatio="xMidYMid meet" />
  </g>;
}
