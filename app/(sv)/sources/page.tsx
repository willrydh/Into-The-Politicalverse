import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import Link from "next/link";
import preparation from "@/data/normalized/election-preparation-2026.json";

export const metadata: Metadata = { ...pageMetadata("sources", "sv"), title: "Datakällor", description: "Öppna valdatakällor, uppdateringstider och verifieringsstatus för Politicalverse." };
const rawPage = "https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026";
const sources = [
  { name: "Personröster och kandidathistorik 2010–2022", status: "Importerad och verifierad", format: "XML + XLSX + CSV · fyra ordinarie val", use: "Officiella personröster i riksdags-, region- och kommunval. Originalarkiv, samlade kandidatprofiler och topplistor. Kopplingar över val är beräknade och osäkra identiteter hålls separata.", url: "https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022" },
  { name: "Valnattens resultatfiler", status: "Genrep verifierat", format: "JSON · ZIP · RSA/SHA-256", use: "Röster och mandat för riket och 29 valkretsar. Preliminär och slutlig räkning hålls separata. Produktionsfilerna publiceras vid valet.", url: "https://www.val.se/valresultat-och-statistik/statistik-och-data/teknisk-beskrivning-av-resultatfiler" },
  { name: "Mottagna förtidsröster", status: "Ansluten", format: "CSV · två uppdateringar per dygn", use: "Nationell totalsumma, datum och kommun. Summaraden kontrolleras men räknas inte en gång till.", url: "https://data.val.se/filer/val2026/rostmottagning/mottagna-fortidsroster-val2026.csv" },
  { name: "Röstberättigade den 14 augusti", status: "Importerad och verifierad", format: "XLSX · kvalifikationsdagen", use: "Röstberättigade, åldersgrupper, kön, förstagångsväljare och utlandssvenskar. Detta är förvalsstatistik, inte valnattens deltagandenämnare.", url: preparation.source.sources.find(s => s.fileName === "eligible-rd.xlsx")!.url },
  { name: "Valdistrikt och jämförbarhet 2026", status: "Importerad och verifierad", format: "XLSX · separata 2026-identiteter", use: "Aktuell distriktsindelning och länkar till jämförbara distrikt 2022. Sammanlagda distrikt och områden som inte kan jämföras markeras uttryckligen.", url: preparation.source.sources.find(s => s.fileName === "district-comparability.xlsx")!.url },
  { name: "Deltagande partier och rapportpartier", status: "Importerad och verifierad", format: "CSV + XLSX · kontrollerat 6 september", use: "Partikoder bevarar inledande nollor. Alla deltagande riksdagspartier finns i registret; rapportpartiernas urval hålls separat.", url: "https://data.val.se/filer/val2026/parti/deltagande-partier.csv" },
  { name: "Kandidaturer och röstningslokaler", status: "Tillgängliga för nästa utbyggnad", format: "CSV + JSON", use: "Kandidaturer uppdateras varje timme. Val- och förtidsröstningslokaler har egna offentliga filer. Kandidater och lokaler ingår ännu inte i produktens gränssnitt.", url: rawPage },
  { name: "GIS för valdistrikten 2026", status: "Tillgängligt för nästa kartlager", format: "GeoJSON · SWEREF99 TM", use: "Nya kartfiler för hela Sverige och per län. Nuvarande historiska karta behåller sin 2022-geografi; lagren blandas inte automatiskt.", url: "https://www.val.se/download/18.332cf48819bd61ac1513889/1785491689960/valdistrikt-riket-2026.zip" },
  { name: "SCB:s Statistikdatabas", status: "API v2 verifierat tillgängligt", format: "JSON-stat2 · tabellmetadata", use: "Valdeltagande och demografisk statistik kan hämtas med dokumenterade region- och tidsurval. Historisk statistik är inte nya valresultat och matas inte in som opinionsmätningar.", url: "https://statistikdatabasen.scb.se/api/v2/index.html" },
  { name: "Riksdagens öppna data", status: "Tillgängligt för kontext", format: "API + dataset", use: "Ledamöter, dokument och voteringar kan ge parlamentarisk bakgrund. De används inte som rösträknings- eller prognosdata.", url: "https://www.riksdagen.se/sv/dokument-och-lagar/riksdagens-oppna-data/" },
  { name: "Valforskningsprogrammet och SVT Valu", status: "Forsknings- och jämförelsekällor", format: "Rapporter · historiska undersökningar", use: "Väljarundersökningar, metodrapporter och historiska vallokalsundersökningar. Något verifierat öppet flöde för Valu 2026 har inte hittats; ett sådant resultat skulle hållas skilt från räknade röster.", url: "https://www.gu.se/valforskningsprogrammet/undersokningar/valundersokningar" },
];

export default function SourcesPage({ locale = "sv" }: { locale?: Locale } = {}) {
  return localizeNode(<div className="product-section source-catalog"><header className="source-hero"><p className="eyebrow eyebrow--dark">Källregister · kontrollerat 6 september 2026</p><h1>Fler källor. Tydliga gränser.</h1><p>Här syns vad som är anslutet, vad som har provats och vad som finns tillgängligt för nästa steg. Varje datatyp har sin egen betydelse och uppdateringstakt.</p></header>
    <div className="source-catalog__grid">{sources.map((source, index) => <article key={source.name} id={`source-${index}`}><span className="source-catalog__status">{source.status}</span><h2>{source.name}</h2><small>{source.format}</small><p>{source.use}</p><a href={source.url} target="_blank" rel="noreferrer">Öppna källan ↗</a></article>)}</div>
    <p className="live-explanation">Nya källor ändrar inte automatiskt den frysta prognosmodellens parametrar. Valnattsresultat, opinionsmätningar och bakgrundsstatistik behandlas var för sig.</p>
    <Link className="text-link" href="/valnatt">Till valnattens presentation →</Link>
  </div>, locale);
}
