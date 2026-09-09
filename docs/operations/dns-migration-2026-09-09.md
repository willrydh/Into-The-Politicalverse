# DNS-avvikelse efter domänflytten

Datum: 9 september 2026. Tider anges i UTC. Detta är en driftanteckning, inte ett påstående om att alla besökare har fått rätt DNS-svar.

## Verifierad avvikelse

Vanlig HTTPS-åtkomst via det kontrollerade nätets ordinarie resolver visade ”Parked at Loopia”. En ny webbläsarflik på `https://politicalverse.se/` visade samma parkering. Det var ett reproducerat tillgänglighetsfel, även om direkt anslutning till Cloudflare fungerade.

Samtliga tio kontrollerade auktoritativa `.se`-servrar delegerade redan till `kurt.ns.cloudflare.com` och `cheryl.ns.cloudflare.com`. Samma värden fanns i Loopia Kundzon. Cloudflare-zonen och dess DNSSEC var aktiva; DS hos `.se` matchade Cloudflare. Ingen återgång i registrardelegeringen observerades.

Cloudflare, Google, Quad9 och OpenDNS gav Cloudflares adresser med DNSSEC-validering. Startsida, svenska och engelska pressidor, topplistor, karta, kandidatprofiler, valnatt och söksida gav HTTP 200 vid direkt TLS-validerad anslutning till Cloudflare. `www` omdirigerade till huvuddomänen med sökväg och parametrar bevarade. Inga aktiva Cloudflare Page Rules eller egna rulesets omdirigerade till Loopia.

Samtidigt lämnade de gamla Loopia-servrarna fortfarande auktoritativa svar med `194.9.94.85` och `194.9.94.86`, TTL 3600. Den gamla zonen innehöll även wildcard-parkering. Nätets resolver hade cachad Loopia-delegering och parkeringsadresser; därför räckte inte en lyckad kontroll av den nya zonen som slutkontroll.

## Genomförd åtgärd

Omkring 11:30 ändrades Loopias webbkonfiguration från **Parkerad** till **Inga inställningar**, med synkronisering av huvuddomän och `www` vald. Sparandet bekräftades och kontrollerades efter omladdning. Inget abonnemang köptes. Registrardelegering, Cloudflare-poster, DNSSEC och webbplatsens kod ändrades inte.

Den gamla Loopia-zonens SOA-serie ändrades från `1788862923` till `1788953414`. Därefter gav apex A NODATA från båda gamla namnserveradresserna, medan wildcard och `www` fortfarande gav parkeringsadresser. Den kostnadsfria webbkonfigurationen hade alltså inte rensat hela den gamla DNS-zonen.

Omkring 11:32 gick även nätets NS-svar över till Cloudflare. Dess gamla A-svar låg fortfarande kvar, med nedräknande TTL. En aktiv kontroll loggar både återstående TTL och vanlig HTTPS-åtkomst; den använder inte `--resolve` för att avgöra om den drabbade åtkomsten har återställts.

Loopias support har, efter ägarens godkännande, fått de tekniska observationerna och ombetts kontrollera den kvarvarande parkeringszonen utan kostnad eller ändring av Cloudflare/DNSSEC. Mottagningsbekräftelse är inte detsamma som en utförd supportåtgärd.

## Öppen verifiering

Vanlig åtkomst genom det tidigare drabbade nätet och supportens tekniska svar återstår. Skriv in tidpunkt och faktiska resultat här när kontrollen slutförs. Påstå inte att borttagning av gamla A-poster omedelbart tömmer besökarnas redan fyllda resolvercacher.

Lanseringsguiden har förtydligats om gammal zon och wildcard, separata NS/DS-cachetider och skillnaden mellan direkt servertest och vanlig webbläsaråtkomst. En avvikelse i något av dessa led ska redovisas som öppen tills just det ledet är verifierat.
