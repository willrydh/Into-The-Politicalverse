# Drift och valnattsberedskap 2026

## Det som finns

- Svenska sidor använder ordinarie adresser. Engelska versioner finns under `/en/`. Språkväljaren behåller aktuell sida. Servertexter översätts före serialisering; interaktiva komponenter använder samma språkregister. HTML-språk, menyer, diagramförklaringar, formulär och källtexter följer språkvalet.
- `/valnatt/` visar officiell rösträkning för riket och valkretsarna, med separata räkningstillfällen. Innan produktionen finns visas vänteläge och verifierade förvalsuppgifter.
- `.github/workflows/election-live.yml` hämtar och validerar myndighetsdata. Det skriver bara `election-2026.json` på datagrenen `live-data`; det bygger inte om hela webbplatsen för varje siffra.
- Webbläsaren kontrollerar den publicerade datafilen varje minut. Under 13–30 september 2026 kör ett startat jobb upprepade, sekventiella källkontroller med fem minuters paus. Varje jobb är begränsat till fyra timmar och startar därefter ett nytt jobb med aktuell main-kod; gemensam concurrency hindrar samtidiga publicerare. Schemat är reservstart, inte enda utlösaren för varje kontroll. Utanför denna period används enstaka schemakontroller. Under oktober–december fortsätter en daglig kontroll av slutliga protokoll och rättelser. GitHub Actions och källans publicering ger ingen garanterad maximal fördröjning. Köer kan förlänga intervallen.
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

## Incident och återställning 13 september 2026

Körning `34758090166` stoppade med `Malformed or unsafe official index entry`. Produktionsindexet returnerade HTTP 200 med exakt `d41d8cd98f00b204e9800998ecf8427e  -`, md5sum-markeringen för tom standardindata. Den sparade myndighetsfilen finns som regressionsfixture med SHA-256 i fixture-proveniensen. Endast den ensamma, exakta markeringen behandlas som tomt index. Andra bindestrecksposter, blandade listor och osäkra sökvägar avvisas fortsatt. Ett läsbart tomt index är vänteläge även efter kl. 20, tills första resultatet publicerats. Om redan publicerade resultat försvinner markeras fel och tidigare resultat behålls.

Den reparerade inhämtningen verifierades mot den verkliga källan kl. 15.26 UTC: inga produktionsresultat publicerade, 3 684 025 mottagna förtidsröster och inga valideringsfel. Källor för kvalifikationsdag, distrikt och jämförbarhet matchade bevarade kontrollsummor. Rapportpartifilen och deltagarregistret hade nya bytes; deras normaliserade riksdagsinnehåll var identiskt (8 rapportpartier och 168 deltagande partier). De granskade versionerna ersätter tidigare källhashar, vilka bevaras i manifestet.

Körningar hade faktiska glapp på flera timmar trots femminuterscron. `scripts/watch-election-live.mjs` håller därför en befintlig Actions-runner aktiv under den intensiva perioden. Den hämtar, publicerar och väntar sekventiellt; publiceringsfel stoppar jobbet, medan källfel publicerar felstatus och bibehållna data inför nästa försök. Den sista kontrollens felstatus avgör jobbresultatet. Vid normal avslutning eller fel försöker arbetsflödet starta efterföljaren; explicit avbrutna jobb startar inte en ny körning. Alla bevakningar upphör vid 1 oktober 00.00 UTC. GitHub-jobbstart och källtillgänglighet kan fortfarande försenas.

Manuella driftkommandon:

```sh
# Kontrollera en gång och avsluta.
gh workflow run election-live.yml --ref main -f single_run=true
# Verifiera överlämning efter en minut; nästa jobb använder normala fyra timmar.
gh workflow run election-live.yml --ref main -f watch_minutes=1
# Starta ordinarie sammanhängande bevakning.
gh workflow run election-live.yml --ref main
```

För driftbevis: följ minst två publicerade kontrolltider, se att efterföljaren faktiskt startar och kontrollera den hämtade datafilen i båda språkversionerna. Ett pågående fyra-timmarsjobb är normalt; dess löpande logg och live-data-commit visar enskilda kontroller. Första signerade produktionspaketet återstår att verifiera när myndigheten publicerar det. Prognosreferensen får aldrig ändras för att passa utfallet.

## Experimental district nowcast

The collector also attempts an isolated, signed preliminary district projection. Review `nowcast` and `nowcastWarnings` in each collection log. A model warning does not make official results unavailable. The national archive, every constituency party total and all district counts must reconcile before a model is available. Follow `docs/methodology/election-nowcast-v2.md` for minimum coverage, sensitivity, collection ballots and the first-production-file gate. After deploying collector changes, cancel only the existing election-watch run and immediately dispatch a replacement from current `main`; cancellation intentionally disables its automatic handoff. Never stop the independent public site or change the forecast reference.

## Visuell sändningsvinjett

Valnattsvyn har en responsiv vinjett med originalkronan och långsam lokal CSS-rörelse. Nedräkningen gäller vallokalernas stängning 13 september 2026 kl. 20.00 svensk tid, inte en utlovad resultattid. Efter stängning står tiden kvar med dåtidsform; verifierade räknade distrikt ersätter klockan när de finns. Inaktuell eller felande källa behåller en uttrycklig varning och senast kontrollerade tid. Grafiken är dekorativ och är inte en uppmätt signal. Text/uppgifter blinkar inte. Rörelsen pausas utanför skärmen och vid operativsystemets minskade rörelse, utan något extra reglage. Kontrollera båda språk, mobil/desktop samt väntande, mottagande och fördröjda tillstånd.

## Model v2 audit

`npm run data:nowcast:verify` reproduces the two-election, twelve-order development report and stress vectors. Do not skip a stale input/code hash. After deploying v2, restart the bounded watch from fresh main and verify both the waiting envelope version and its advancing check time. When results exist, reconcile v2 observed totals with the signed official file and inspect effective districts, geographic spread, extrapolation, selected estimator and unresolved majority draws. Keep the first-production-district-file gate explicit until that file has actually been processed.

`npm run data:nowcast:audit -- --fetch` reads existing live-data commit history and writes a report under `/tmp`. It grades only archived predictions preceding a complete later final-count source. Before that, it reports waiting status. It never rewrites history, the live feed or the frozen polling forecast.

## First-result waiting state

A well-formed, reachable official index may remain empty after 20:00. Until a phase has ever published a result, keep that phase waiting. Do not infer a failed source from the closing clock. HTTP failures or previously published result archives disappearing remain errors; retain verified snapshots. This distinction was verified against the official empty index after 20:00 on 13 September.
