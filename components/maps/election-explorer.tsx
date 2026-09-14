"use client";
import type { LocalIndexModel } from "@/lib/data/geography/local-types";
import { useLocale } from "../localize";
import { AreaResults } from "../live/area-results";
import { LocalElectionExplorer } from "./local-election-explorer";
import { navigateLocalQuery, useLocalQuery } from "./local-url";

export function ElectionExplorer({ model }: { model: LocalIndexModel }) {
  const sv = useLocale() === "sv", query = useLocalQuery(), params = new URLSearchParams(query);
  const requested = params.get("year"), historical = requested ? requested !== "2026" : params.has("district") || params.has("constituency");
  function switchYear(year: string) {
    const next = new URLSearchParams(query); next.set("year", year);
    for (const key of ["district", "constituency", "stage", "election"]) next.delete(key);
    navigateLocalQuery(`?${next}`);
  }
  return <><div className="area-tabs" aria-label={sv ? "Resultat och historik" : "Results and history"}><button type="button" aria-pressed={!historical} onClick={() => switchYear("2026")}>{sv ? "Valresultat 2026" : "2026 results"}</button><button type="button" aria-pressed={historical} onClick={() => switchYear("2022")}>{sv ? "Historisk karta · 2010–2022" : "Historical map · 2010–2022"}</button></div>{historical ? <LocalElectionExplorer model={model} /> : <AreaResults geography={model} />}</>;
}
