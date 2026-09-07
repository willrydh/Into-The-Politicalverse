# Drift och valnattsberedskap 2026

## Det som finns

- Svenska sidor använder ordinarie adresser. Engelska versioner finns under `/en/`. Språkväljaren behåller aktuell sida. Servertexter översätts före serialisering; interaktiva komponenter använder samma språkregister. HTML-språk, menyer, diagramförklaringar, formulär och källtexter följer språkvalet.
- `/valnatt/` visar officiell rösträkning för riket och valkretsarna, med separata räkningstillfällen. Innan produktionen finns visas vänteläge och verifierade förvalsuppgifter.
- `.github/workflows/election-live.yml` hämtar och validerar myndighetsdata. Det skriver bara `election-2026.json` på datagrenen `live-data`; det bygger inte om hela webbplatsen för varje siffra.
- Webbläsaren kontrollerar den publicerade datafilen varje minut. Schemat hämtar förtidsröster efter källans två dagliga uppdateringar och valresultat ungefär var femte minut 13–30 september 2026. Under oktober–december fortsätter en daglig kontroll av slutliga protokoll och rättelser. GitHub Actions och källans publicering ger ingen garanterad maximal fördröjning. Köer kan förlänga intervallen.
- Valideringsfel syns i arbetsflödet och som fördröjning i produkten. Senast godkända data behålls. Felmail tystas inte genom att dölja verkliga fel.

Senaste data: <https://raw.githubusercontent.com/willrydh/Into-The-Politicalverse/live-data/election-2026.json>.

`/api/elections/2026/live-baseline.json` är en reservkopia från senaste webbbygget. Den är inte minutflödet. `/api/elections/2026/preparation.json` innehåller förvalsunderlag med källor och datum.

## Kontroller inför och under valet

1. Kör `npm run data:verify` och `npm run check` före kodpublicering. `npm run data:live:rehearse` hämtar de riktiga signerade genrepsfilerna till ignorerad `data/rehearsal/`; de får inte kopieras till produktionen.
2. Kör `npm run data:live:update` eller starta arbetsflödet **Refresh official election-night data** manuellt. Före valdagen är en saknad produktionsindexfil ett normalt vänteläge. Efter 13 september kl. 20 svensk tid ger utebliven produktion ett tydligt fel.
3. Kontrollera arbetsflödets resultat och datafilens `checkedAt`, `stageStatus`, `earlyVotingStatus` och källornas egna tidsstämplar. Ett nytt kontrollögonblick betyder inte automatiskt att nya röster publicerats.
4. Öppna båda språkversionerna av valnattsvyn. Kontrollera att aktuell datafil hämtas, att vänteläge övergår till riktiga resultat och att räkningstillfällena hålls åtskilda. Kontrollera riket och minst två valkretsar mot Valmyndigheten.
5. Om en källa ändrar schema eller certifikat: behåll senaste godkända data, granska ändringen, uppdatera adapter och tester, publicera och kör om. Ändra aldrig bort signatur- eller summeringskontroller för att få en grön körning.
6. Om Actions-kön blir för lång kan den redan validerade CLI-hämtningen köras manuellt mot en färsk utcheckning av `live-data`: `npm run data:live:update -- --output /sökväg/till/live-data/election-2026.json`. Granska statusen och publicera bara denna fil på `live-data`. Använd samma validering och gren; forcera inte en push.

## Bevis och kvarstående gräns

Båda myndighetsgenrepen är kryptografiskt och matematiskt verifierade. Förtidsröster, röstberättigade, distrikt, jämförbarhet och partiregister har hämtats från riktiga källor. Automatiska tester täcker skadade filer, testdata i produktion, fel nämnare, fel mandatstruktur, summeringar, gamla versioner, nollrapportering, sommar/vintertid och bibehållna data vid avbrott.

Produktionsresultaten finns ännu inte den 6 september. Det första riktiga produktionspaketet och myndighetens faktiska publiceringstakt kan därför inte slutverifieras i förväg. Beredskapen är provad mot officiella genrep och feltester; den är ingen garanti för obruten realtidsleverans eller en statistiskt felfri förvalsprognos.

Källinventering: [2026 års datakällor](../data-sources/election-2026.md). Matematik: [Valnattsmetod v1](../methodology/election-night-v1.md).

Prognosreferens, utvärdering och separat personröstmottagning: [övergång till 2026 års resultat](election-transition-2026.md).
