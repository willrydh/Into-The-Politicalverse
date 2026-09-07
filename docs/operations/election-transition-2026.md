# Övergång till 2026 års resultat

Förberett 7 september 2026. Nuvarande historik, kartor och kandidatlänkning behåller sina verifierade år. Nya resultat publiceras först i valnattsflödet; införandet i historiken är en separat, granskad åtgärd.

## Sparad prognos

- `data/normalized/election-forecast-reference-2026.json` bevarar hela prognosen, dess SHA-256, modellversion, källor, intervall och tid då referensen sparades. Git-historiken bevarar tidigare referenser.
- `npm run data:forecast:reference` körs efter den ordinarie validerade pollinguppdateringen och före releasekontrollerna. Filen följer senast accepterad prognos fram till **13 september kl. 00.00 svensk tid** (`2026-09-12T22:00:00Z`). Källornas datumupplösning är dagar; därför tillåts inga valdagspublicerade mätningar i referensen.
- Från denna gräns lämnas referensen orörd, även vid manuella körningar. Saknas den då stoppas skapandet; en prognos får inte skapas i efterhand för att utvärdera det aktuella valet. Pollinguppdateringen kontrollerar gränsen både före hämtningen och före skrivningen.
- `data:verify` kontrollerar referensens innehållshash och förvalsdatum. Före gränsen måste den matcha den accepterade prognosen. Ändra inte modellens frysta parametrar för att förbättra efterhandsresultatet.

## Valdagen och efterräkningen

Det befintliga signerade Riksdagsflödet behåller preliminär och slutlig räkning oberoende. Klienten hämtar varje minut; schemat kontrollerar ungefär var femte minut 13–30 september. Dagliga kontroller fortsätter oktober–december 2026. GitHub Actions är en leverans med varierande fördröjning, inte en garanterad realtidstjänst.

När verifierade nationella röster har kommit visas jämförelsen automatiskt under resultatet på `/valnatt/`, i båda språken. Den färskaste publicerade referensen hämtas då separat och dess hash kontrolleras i webbläsaren, även om fliken öppnades före valet. Ett fel i referenshämtningen påverkar inte visningen av officiella röster.

- Nationell prognos jämförs endast med nationellt resultat, aldrig med en vald enskild valkrets.
- Röstandel = partiets räknade röster / samtliga giltiga röster, inklusive andra partier. Godkända utlandsröster följer de officiella totalsummorna och adderas inte en extra gång.
- Skillnad = räknat utfall minus prognos, i **procentenheter** respektive mandat. Plus betyder högre utfall än prognosen.
- Saknat parti eller mandat är okänt, inte noll. Inga egna mandat beräknas i jämförelsen.
- Under pågående räkning visas preliminär jämförelse med distriktstäckning. Distriktstäckning är inte andelen färdigräknade röster och tidiga distrikt är inget representativt urval.
- Samlad utvärdering kräver slutlig räkning, samtliga distrikt, alla åtta jämförelsepartier, 349 rapporterade mandat och publicerat huvudprotokoll. MAE är medelvärdet av absolutfelet i röstandel för de **åtta prognostiserade partierna**. Intervallträffar avser deras 80-procentiga röstintervall. En enskild valomgång bevisar inte sannolikhetskalibrering.
- Senare officiella rättelser får uppdatera utfallet, men aldrig förvalsreferensen. Revision och källtid visas. Regeringsbildning härleds inte ur tabellen.

## Mottagning av nya personröster

`npm run data:2026:stage` hämtar den publicerade signerade sluträkningsfilen för Riksdagen. Innan den finns rapporteras vänteläge och befintliga data lämnas kvar. `--rehearsal` är uttryckligt genrep och skriver i en annan, ignorerad katalog.

1. Befintlig signatur-, certifikat-, validentitets-, revisions-, röstsummes- och mandatkontroll måste passera.
2. Personröster läses per **parti och riksdagsvalkrets**. Summerade personröster jämförs med de separata valsedelslistorna när dessa finns. Dubbla listor/kandidater, fel nämnare eller motstridiga summeringar stoppar mottagningen.
3. `null` för personröster bevaras som saknat underlag. En kandidatur i förvalsregistret är inte ett valresultat. Kandidatnumret gäller det aktuella valet.
4. Utdata hamnar endast i `data/staging/2026/riksdag.json` med `publication: staging-only`. Testdata är märkt `TEST` och hamnar under `data/rehearsal/`. Båda katalogerna är uteslutna från Git och webbbyggets datakällor.
5. Publicering i profiler, topplistor, sökning och historiska kartor kräver granskad 2026-geografi, full källtäckning, dokumenterade jämförelselänkar till 2022 och identitetskontroll. Slå inte bara på 2026 i `CANDIDATE_YEARS` eller `LOCAL_YEARS`. Region- och kommunval behöver egna signerade områdesadaptrar; Riksdagsresultat får inte ersätta dem. Dessa två adaptrar är ännu inte anslutna till 2026-intaget.

Detta förbereder Riksdagens faktiska personröstschema utan att införa halvfärdiga 2026-profiler eller ersätta 2022 års gränser. Den första produktionsfilen och nästa steg till historiken måste fortfarande granskas när källan är publicerad.

## Kontroll före driftsättning

Kör `npm run data:forecast:reference`, `npm run data:verify`, `npm run check` och Pages-bygget. Tester omfattar låsgräns, efterhandsförsök, saknade/partiella resultat, nämnare, preliminär/slutlig/protokollstatus, officiella rättelser och personröstsummering från myndighetens bevarade genrep. Kontrollera båda språken, mobilen och att valnattsvyn fortsätter visa sitt vänteläge före valet. Genrep får aldrig publiceras som produktionsresultat.

Myndighetens [tekniska specifikation](https://www.val.se/valresultat-och-statistik/statistik-och-data/teknisk-beskrivning-av-resultatfiler) och [schema för slutlig mandatfördelning](https://www.val.se/download/18.1a2972da19f159e73fd324f/1786558968669/slut-mandatfordelning.md) kontrollerades 7 september. [Rådatakatalogen 2026](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026) publicerar ytterligare filer efter hand. Förutsätt inte att ännu opublicerade slutliga kommun-, region- eller personfiler har verifierats i produktion.
