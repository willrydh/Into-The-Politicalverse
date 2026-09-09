# Kontroll av den publika domänen

Efter DNS-avvikelsen den 9 september 2026 kontrolleras den vanliga publika åtkomsten separat från byggtester och direktkontroller av webbservern.

## Körning

`Check public domain health` i GitHub Actions har schema var femtonde minut, på minut 7, 22, 37 och 52. Båda publiceringsflödena, vanlig Pages-publicering och publicering efter polluppdatering, anropar dessutom samma kontroll efter genomförd driftsättning. Kontrollen kan startas manuellt från Actions eller lokalt:

```sh
npm run health:domain -- --report /tmp/politicalverse-health.json
```

Node 22 räcker; inga npm-paket, kontonycklar eller behörigheter att ändra DNS behövs. `--once` gör en enda kontrollomgång vid felsökning. Den vanliga körningen försöker högst tre gånger, med 20 sekunders mellanrum, och avslutar tidigt om en hel omgång lyckas. Alla försök finns i rapporten, även övergående fel som sedan försvunnit.

## Vad som krävs för godkänt

- Både Cloudflares och Googles resolverare måste lämna DNSSEC-validerade NS-svar med exakt `cheryl.ns.cloudflare.com` och `kurt.ns.cloudflare.com`.
- Båda måste också ge DNSSEC-validerade A- och AAAA-svar för huvuddomänen och `www`. Saknade, ogiltiga, trunkerade och overifierade svar underkänns. Kända Loopia-parkeringsadresser får inte finnas bland svaren.
- Körmiljöns vanliga systemuppslag kontrolleras separat för både huvuddomänen och `www`. Roterande Cloudflare-proxyadresser är inte hårdkodade som en godkänd adresslista.
- Vanlig HTTPS måste visa Politicalverse på startsidan, engelska startsidan och topplistan, med rätt sidtitel, canonical-adress och manifestlänk. HTTP 200 från en parkeringssida är ett fel. Certifikatvalidering är på; ingen `--resolve`, alternativ resolver för sidförfrågan eller TLS-genväg används.
- Appmanifestet ska ha rätt projektidentitet och basväg. HTTP och HTTPS-`www` ska omdirigera permanent till huvuddomänen och behålla en verklig topplistesökväg med dess parametrar.

Det är 18 kontroller per omgång. Förfrågningar har tids- och storleksgränser. Omdirigeringar läses men följs inte automatiskt. Skriptet startar ingen besökarsession och skickar inga analys- eller administrationshändelser.

## Larm och åtgärd

Ett fel som kvarstår efter försöken ger en misslyckad Actions-körning. Vid publicering innebär det att hela publiceringsflödet blir rött trots att själva uppladdningen kan ha lyckats. Ingen automatisk återställning sker. Körningens sammanfattning visar exakt vilka kontroller som fallerade; JSON-rapporten sparar DNS-värden, TTL och tidsstämplar som en `domain-health`-artefakt i 14 dagar.

GitHubs egna Actions-notiser används. E-postleverans beror på ägarens GitHub-inställningar för Actions-notiser; arbetsflödet skapar ingen separat e-posttjänst och garanterar inte att ett mejl har mottagits. Schemat gäller på huvudgrenen. Starta en manuell körning efter att arbetsflödet lagts in och kontrollera en schemalagd körning. Se [Actions-notiser](https://docs.github.com/en/account-and-profile/managing-subscriptions-and-notifications-on-github/setting-up-notifications/configuring-notifications#github-actions-notification-options).

Vid fel: läs rapporten och följ [domänflyttens felsökning](loopia-domain-launch.md). Jämför drabbat nät, publika resolverare, överordnad zon och auktoritativa servrar innan någon ändring görs. Ändra inte namnservrar, stäng inte av DNSSEC och flytta inte sajten automatiskt på grund av ett enstaka fel. Avsiktliga framtida ändringar av namnservrar eller webbstruktur ska uppdatera kontrollens kontrakt i samma granskade arbete.

## Gränser

Kontrollen upptäcker fel från GitHubs körmiljö och två publika resolverare. Den garanterar inte samma svar i alla operatörers DNS-cache och förhindrar inte driftstörningar hos leverantörer. GitHub kan fördröja schemakörningar; femton minuter är ett schema, inte en garanterad larmtid. Publika inaktiva repor kan få scheman avstängda efter 60 dagar utan aktivitet. Se [GitHubs schemabegränsningar](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Testerna reproducerar gammal Loopia-delegering, blandade parkeringsadresser, saknad DNSSEC, HTTP 200-parkering, felaktiga omdirigeringar, avvikande system-DNS och tillfälliga respektive bestående fel. Kontrollerna ersätter inte funktionstestning av valdata eller faktisk iPhone/PWA-verifiering.

DNS-svarens format och AD/CD-flaggor följer [Cloudflares DoH-dokumentation](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/) och [Googles JSON-API](https://developers.google.com/speed/public-dns/docs/doh/json). Formatet valideras och förändrade/ofullständiga svar ger fel; skriptet är en driftkontroll, inte en DNS-resolver för användarna.
