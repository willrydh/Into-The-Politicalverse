# Resultat efter valdagen 2026

Update 21 September 2026: [established 2026 results and personal-vote import](../operations/candidate-results-2026.md) supersede the earlier pending-year limitation. Signed established areas, current-result precedence, preserved profile identities and automatic publication are now implemented. Earlier source/method records below remain historical context.

Infört 14 september 2026. Källa: [Valmyndighetens rådata](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026), [teknisk beskrivning](https://www.val.se/valresultat-och-statistik/statistik-och-data/teknisk-beskrivning-av-resultatfiler) och signerade produktionspaket. Granskningens tidsstämplar och hashar finns i `data/raw/valmyndigheten-2026/post-election-review-2026-09-14.json`. Detta dokument beskriver anslutningen, inte ett löfte om att rösterna är färdigräknade.

## Anslutna data

- Alla 311 preliminära valområden: riksdagen, 20 regionval och 290 kommunval. Gotland har inget separat regionval.
- Riksdagens 29 valkretsar i det befintliga nationella flödet.
- Alla 290 kommuners riksdagsröster och regionvalens kommunvisa summeringar från separata signerade filer i respektive arkiv.
- Partiernas röster, exakta röstandelar, publicerade mandat, rapporterade distrikt, giltiga/ogiltiga röster, röstberättigade och deltagande i rapporterade distrikt.
- 2022 års jämförelser från samma signerade resultatfil: partiernas röster, andelar och tillgängliga mandat. `statusJamforelse` måste vara `Kan jämföras` och föregående valdatum `2022-09-11`. Saknade partivärden förblir null, även för ett nytt lokalt parti.
- Mottagna förtidsröster fortsätter uppdateras separat. De adderas aldrig till redan redovisade valresultat.

Vid denna kontroll innehöll myndighetens index **inga sluträkningsarkiv**. Inga personröster för 2026 infördes i profiler, topplistor, sökindex eller delningskort. Ett kandidatregister är inte ett personröstresultat. Historiken 2010–2022 är oförändrad.

SVT:s Valu-fil kontrollerades igen: exakt samma SHA-256 och partisiffror som den godkända kopian den 13 september. Indexet har även fått separata länkar till SVT:s prognos och valresultat; dessa importeras inte som Valu. SCB:s historiska kontext är inte nya valresultat. Fryst förvalsprognos och V2-parametrar är oförändrade.

## Publiceringskedja

`scripts/update-election-live.ts` skriver först `election-2026.json` och därefter `area-results-2026.json`. Det större områdesflödet laddas enbart av vyer som behöver det, inte av det gemensamma sidhuvudet. Båda klienterna använder en gemensam minutnyckel i dataadressen så att GitHubs femminuterscache för grenadresser inte döljer en ny publicering. Ett test återger cachebeteendet över ett minutbyte. Båda filer publiceras av samma befintliga utgivare på `live-data`, med en uttrycklig tvåfilslista i `watch-election-live.mjs`. Grenen får aldrig slås ihop med `main`.

Områdesadaptern läser hela MD5-indexet och hämtar bara förändrade arkiv, med högst fyra samtidiga hämtningar. Varje ZIP måste matcha indexets checksumma. Index/ZIP kan tillfälligt tillhöra olika publiceringsgenerationer; återförsöken är begränsade och kräver en ny verifierad matchning. Varje JSON verifieras separat med det befintliga låsta signeringscertifikatet. Testdata, fel datum/valtyp/område/fas, dubletter, fel nämnare, mandat- eller röstsummor stoppas.

RD-mandat fortsätter verifieras med den oberoende mandatmotorn. RF/KF-mandat återges från myndigheten och måste summera till det aktuella valområdets publicerade mandatantal. Kommunala mandat kan sakna uppdelning i fasta/utjämningsmandat; frånvarande komponenter anges inte som noll. Kommunernas RD- och RF-röster får aldrig tilldelas egna mandat.

De signerade kommunala summeringarna måste tillhöra samma arkiv och revision som valområdets huvudresultat. Alla kommuners röster, partier, distrikt och nämnare måste summera tillbaka till huvudresultatet. Summerade RD-län visas som beräkningar från dessa kommuner. Kommun- och länskoder får inte ersättas med riksdagsvalkretsar.

Varje område och fas behåller senast verifierat resultat vid fel. Korrigeringar kan minska röster/distrikt, men källrevision och källtid får inte gå bakåt. Oförändrad revision får inte byta innehåll. Browservalideringen kontrollerar proveniens och visningsmatematik igen. Misslyckad källkontroll eller gammalt kontrollögonblick visas som fördröjning. Oförändrade källsiffror är däremot inte i sig ett fel.

Områdeshämtningen slutar starta nya arkiv efter fyra minuter. Den yttre insamlingen har en åttaminutersgräns. Den vanliga femminuterspausen, fyra timmars bevakning, ensam utgivare, överlämning och stoppdatum 1 oktober består. Fortsatta dagliga protokollkontroller sker oktober–december. Källan bestämmer när nya uppgifter finns.

## Avrundning och jämförelse

Röstandelen beräknas från heltalsröster och samtliga giltiga röster. Förändring av andel är **procentenheter**, inte procentuell ökning av antalet röster. Sortering använder exakta tal före presentation.

Fem signerade produktionsfiler visade ett särskilt visningsvärde precis under mandatspärren: 0560, 0883, 1481 och 1782 KF hade 1,9 i stället för vanlig avrundning till 2,0; RF 22 hade 2,9 i stället för 3,0. Samtliga hade `deltaMandatfordelning: nej` och exakta röstandelar under den angivna spärren. Detta mönster accepteras endast när andelen är inom en halv tiondel **under** den uttryckliga 2-, 3- eller 4-procentsspärren, källvärdet är spärren minus 0,1 och deltagandefältet är `nej`. Övriga avrundningskontroller är oförändrade. Vi känner inte till källsystemets avsikt; vi återger aldrig avrundningen som bevis för mandatbehörighet. De exakta röstetalen och myndighetens mandat är styrande. Fem rådatafixturer bevarar observationen.

2026 visas först; liten 2022-röstsumma och andels-/mandatförändring ligger i befintliga kolumner. Förklaringen ligger under tabellen. Saknade jämförelser visas med streck. Pågående 2026-räkning jämförs mot källans hela jämförbara 2022-resultat; detta är inte en prognos för återstående distrikt eller en slutlig utvärdering.

Nettorörlighet (`pv-count-indicators-1.0.0`) = halva summan av absoluta förändringar i alla redovisade partiers andelar, inklusive övriga. Hela jämförelsemängden måste finnas. Måttet beskriver ändrade partistyrkor och fastställer inte individers partibyten. Vyerna visar största positiva och negativa andelsförändring med samma regel för alla partier.

## Vyer och övergång

- Startsidan och valnatten: räknade röster och kompakta jämförelser mot 2022.
- Valarkivet: 2026 först, äldre fastställda val och granskad regeringskontext kvar. Ingen regering 2026 härleds ur mandatbilden.
- Grafer: räknat 2026 mot 2022 före den separata slutliga historiken 2002–2022.
- Partier: aktuell riksdagsandel, röster och mandat, jämförelse mot 2022 och kommunernas rapporterade stöd. Äldre staplar är fastställd historik; 2026 är räkningen hittills.
- Indikatorer: nya räknade 2026-förändringar först; 2022/2018-indikatorerna uttryckligt märkta som historik.
- `/maps/?year=2026`: valtyp, län, kommun och rösträkningsfas. Alla reglage är alltid framme. Historiska kartan och gamla områdeslänkar behåller 2010–2022-geografin. Inga 2026-distriktsröster målas på ogranskade äldre gränser.
- Källor och press: faktisk anslutning, uppdateringstakt, modellgränser och personrösternas nästa steg.

Samlad resultatbild behåller preliminärt resultat tills den slutliga räkningen omfattar hela valområdet; användaren kan välja respektive fas separat. Fastställt kräver dessutom giltiga röster, komplett publicerad mandatfördelning och myndighetens protokoll. Faserna summeras aldrig. De sena förtids-/utlandsrösterna kommer med när myndigheten redovisar dem; uppsamlingsröster läggs inte till igen.

Riksdagens befintliga personröststaging klarar nu även explicita nullfördelningar i ännu oräknade valkretsar. Nästa personröstlansering kräver granskning av de verkliga sluträkningsfilerna för **alla tre valtyper**, listplatser, full källtäckning, jämförbar geografi och konservativa personlänkar. Ändra inte bara `CANDIDATE_YEARS`: profiler, topplistekohorter och OG måste byggas ur samma godkända generation.

## Verifiering

`tests/post-election.test.ts` använder bevarade signerade Mark-arkivet, verkliga RD/RF/KF-resultat samt de fem spärrfixturerna. Det täcker jämförelsematematik, kommunavstämning, rätt valtyp/fas, lokala partier, nullvärden, ändrade källor, oförändrade ZIP-filer, felretention och övergång till fastställt resultat. Hela de 311 publicerade områdena valideras också som ett sammanhängande leveransprov.

Kör `npm run check` och `npm run data:verify`. Det senare omfattar fortsatt de båda historiska V2-kontrollerna med tolv rapportordningar per val. Kontrollera mobila och stationära vyer på båda språken, kontrollernas URL/bakåt-beteende, kommunval/regionval/riksdagskommun, sortering, Gotland och vänteläget för slutlig räkning. Publicera via ordinarie GitHub Pages, låt domänhälsan passera, starta om endast den befintliga valdatabevakningen med ny `main` och verifiera två ökande kontrolltider på båda publika datafilerna.
