"use client";

import { useLocale } from "../localize";
import { CANDIDATE_METHOD, type Person } from "@/lib/candidates/types";

export function ProfileDownload({ person }: { person: Person }) {
  const sv = useLocale() === "sv";
  function download() {
    const payload = { schemaVersion: 1, methodVersion: CANDIDATE_METHOD, classifications: { results: "OFFICIAL", identityLinks: "DERIVED" }, person };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `politicalverse-${person.id}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    // Allow browsers time to start the download before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return <div><p className="local-note">{sv ? "Uppgifterna visas i profilen ovan. Exporten innehåller den här personens alla val och områden för egen analys." : "The information is presented in the profile above. The export contains this person’s elections and areas for your own analysis."}</p><button type="button" className="button" onClick={download}>{sv ? "Ladda ned profilens data (JSON)" : "Download profile data (JSON)"} <span aria-hidden="true">↓</span></button></div>;
}
