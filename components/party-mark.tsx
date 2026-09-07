"use client";
import { useLocale } from "@/components/localize";
import Image from "next/image";
import type { PartyDefinition } from "@/lib/parties";
import { translateText } from "@/lib/i18n/translate";

type PartyMarkProps = {
  party: PartyDefinition;
  size?: "sm" | "md" | "lg";
  label?: string;
};

export function PartyMark({ party, size = "md", label }: PartyMarkProps) {
  const name = translateText(label ?? party.name, useLocale());
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (!party.logo) return <span className="party-other">{name}</span>;
  return (
    <span className={`party-mark party-mark--${size}`} title={name}>
      <Image src={`${basePath}${party.logo}`} alt={name} width={72} height={72} />
    </span>
  );
}
