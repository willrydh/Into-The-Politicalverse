import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { PartyExplorer } from "@/components/party-explorer";
import { getPartyProfiles } from "@/lib/data/elections";

export const metadata: Metadata = { title: "Parties" };

export default function PartiesPage() {
  return (
    <div className="interior-page">
      <header className="interior-hero interior-hero--party">
        <div><p className="eyebrow eyebrow--light">Party explorer · 2006—2022</p><h1>One party.<br /><em>Every angle.</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">Select a party to follow its national vote, election-to-election swing and municipal geography. Every figure is the final Riksdag result.</p><DataSource compact /></div>
      </header>
      <section className="interior-panel interior-panel--flush">
        <PartyExplorer profiles={getPartyProfiles()} />
      </section>
    </div>
  );
}
