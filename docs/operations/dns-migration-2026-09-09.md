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

## Återställd åtkomst och kvarvarande supportärende

Ägaren bekräftade omkring 12:00 att sajten var uppe från hans nät. Den separata kontrollmiljön visade fortfarande parkering via vanlig HTTPS. Vid 12:11:58 gav dess vanliga `dig`-uppslag de nya Cloudflare-adresserna efter att den gamla A-postens TTL löpt ut, medan vanlig HTTPS ännu visade parkering. Detta visar varför ett lyckat separat DNS-uppslag inte ensamt avslutar en incident; även systemets/webbläsarens åtkomst behöver kontrolleras.

Vid 12:18:17 uppdaterades även macOS systemuppslag till Cloudflare. Den vanliga HTTPS-kontrollen gav rätt Politicalverse-sida vid 12:18:37, och samtliga 18 domänkontroller passerade vid 12:18:49. Den tidigare drabbade webbläsarfliken visade också Politicalverse efter vanlig omladdning. Ingen hosts-ändring, påtvingad resolver, avstängd TLS-validering eller global cachetömning användes för att få godkänt.

Loopias tekniska bekräftelse på rensning av den gamla wildcard/www-parkeringen återstår. Supporten har fått en uppdatering om att ägarens åtkomst fungerar och att den aktiva Cloudflare-delegeringen och DNSSEC ska lämnas orörda. Borttagning av gamla poster tömmer inte omedelbart alla besökares resolvercacher.

Lanseringsguiden har förtydligats om gammal zon och wildcard, separata NS/DS-cachetider och skillnaden mellan direkt servertest och vanlig webbläsaråtkomst. En avvikelse i något av dessa led ska redovisas som öppen tills just det ledet är verifierat.

Den nya [domänkontrollen](domain-health.md) gav vid 12:08 underkänt för system-DNS, vanlig HTTPS, manifest och HTTP-omdirigering, trots att båda publika resolverarna och `www` var godkända. Incidenten har därmed även fungerat som ett skarpt negativt test av bevakningen, utöver dess automatiserade regressionstester.

Bevakningen infördes via [PR 52](https://github.com/willrydh/Into-The-Politicalverse/pull/52), commit `d6c8ded6bd53b3167bce59b386b01f983c47c69d`. Dataverifiering, lint, typkontroller, 153 tester och bygge godkändes, även i GitHubs PR-kontroll. Den första [oberoende GitHub-körningen](https://github.com/willrydh/Into-The-Politicalverse/actions/runs/34350344101) passerade alla 18 kontroller. Schema och kontroller efter båda publiceringsvägarna finns i `domain-health.yml`.
