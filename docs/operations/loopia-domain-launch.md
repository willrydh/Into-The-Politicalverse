# Lansera en domän från Loopia

Återanvändbar arbetsgång för en domän som är registrerad hos Loopia men ska använda Cloudflare som DNS-leverantör. Webbplatsen kan ligga kvar hos sin befintliga webbhost. Loopia fortsätter sköta registrering och förnyelse av domänen.

Guiden är kontrollerad mot leverantörernas dokumentation den 9 september 2026. Aktuella namnservrar, DNS-värden och certifikatstatus ska alltid hämtas från det nya projektets egna konton. Kopiera inte ett annat projekts namnservrar eller hostingmål.

## Före ändringen

Fastställ rätt domän, registrarkonto, Cloudflare-konto, webbprojekt och publiceringsflöde. Läs aktuella instruktioner i projektet och bevara pågående lokala ändringar. Arbeta i en separat gren eller worktree från den senast publicerade huvudgrenen.

Dokumentera nuvarande namnservrar och alla DNS-poster: A, AAAA, CNAME, MX, TXT, CAA, SRV och eventuella delegeringar. Kontrollera särskilt e-postens MX, SPF, DKIM och DMARC samt externa verifieringsposter. En automatisk DNS-import är ett hjälpmedel, inte bevis för att allt kommit med. Spara en återställningsbar export utan lösenord eller API-nycklar.

Kontrollera också den gamla zonens webbparkering, inklusive `www` och wildcard (`*`). Resolverare med cachad gammal delegering kan fortsätta fråga de gamla namnservrarna och därmed förnya felaktiga adressposter. Förbered helst samma fungerande webbpekning hos både gammal och ny DNS-leverantör under övergången. Namnserverbytet i sig tar inte bort en parkeringszon hos Loopia.

Ett LoopiaDomän-konto räcker för externa Cloudflare-namnservrar; beställ inte LoopiaDNS för den aktiva Cloudflare-zonen. Vid denna kontroll är redigering av enskilda poster i Loopias gamla zon låst bakom deras betalda DNS-tjänst. Om gamla poster behöver rättas men redigering saknas, ordna en uttryckligt godkänd åtgärd med registraren före lanseringen. Att välja **Inga inställningar** tar bort Loopias webbkonfiguration men är inte bevis för att hela den gamla DNS-zonen, inklusive wildcard, har försvunnit. Kontrollera faktiska svar. Ett tomt svar från den gamla zonen ersätter heller inte behovet av en fungerande övergång för besökare med gammal delegering.

Läs DNSSEC-status både i Loopia och i den överordnade zonen. Anteckna befintlig DS-post och dess TTL innan den tas bort. En knapp som visar avaktiverat i kundzonen bevisar inte att ändringen har nått registret.

## Gör webbplatsen klar

Bygg och testa webbplatsen före ompekningen. Anpassa alla interna resurser för den nya URL-strukturen: bilder, skript, CSS, JSON, språkversioner, manifest, ikoner och delningsbilder. Om en projektsida flyttar från `/projektnamn/` till domänens rot ska byggsystemets basväg ändras till tom sträng.

Ange den föredragna HTTPS-domänen i canonical-länkar, Open Graph och sitemap. Koppla språkversioner med hreflang och håll svenska och engelska adresser konsekventa. Sökresultat behöver normalt inte indexeras som separata sidor. Blockera inte resurser som sökmotorer behöver för att kunna rendera innehållet.

Bestäm om huvuddomänen ska ha `www` eller inte. Den andra varianten ska omdirigera permanent, med sökväg och relevanta sökparametrar bevarade. Kontrollera även gamla delade länkar, favoriter och hemskärmsappar.

## Skapa den nya DNS-zonen

Skapa domänen i rätt Cloudflare-konto. Välj en passande befintlig plan och kontrollera eventuella kostnader innan en betald tjänst beställs. Kopiera nuvarande fungerande poster först. Kontrollera svar direkt från båda tilldelade Cloudflare-namnservrarna innan delegationen ändras.

Cloudflare tilldelar domänspecifika namnservrar. Ange exakt de värden som visas för den nya zonen; de behöver inte vara samma som för andra domäner i kontot.

Verifiera domänägarskap hos webbhosten när det stöds. Behåll verifieringsposten efter lyckad kontroll så att skyddet mot att någon annan använder domänen består.

## Byt DNSSEC och namnservrar i rätt ordning

Om den gamla DNS-leverantören signerar zonen måste dess DS-post normalt tas bort hos registraren före namnserverbytet. Detta är ett tillfälligt avbrott i DNSSEC-skyddet och ska vara uttryckligen godkänt. Kontrollera [Cloudflares aktuella migrationsanvisningar](https://developers.cloudflare.com/dns/dnssec/) för situationer med flera signerare.

I Loopia Kundzon: öppna domänen, välj DNSSEC och avaktivera den gamla signeringen. Vänta tills DS-posten faktiskt försvunnit ur den överordnade zonen. Låt därefter hela den tidigare DS-postens TTL löpa ut innan namnservrarna byts, så att gamla cachelagrade signaturer inte orsakar SERVFAIL.

För en `.se`-domän kan en kontroll se ut så här:

```sh
dig NS se. +short
dig @a.ns.se exempel.se DS +dnssec +noall +answer +authority
```

Använd den aktuella överordnade namnservern för den aktuella toppdomänen. Anteckna tidpunkten när DS-posten bekräftats borttagen. Skilj ett tomt svar från ett timeout- eller nätverksfel.

Öppna sedan domänens **Namnservrar / DNS-servrar** i Loopia och ersätt de gamla värdena med Cloudflares tilldelade namnservrar. Spara, läs bekräftelsen och kontrollera registrardata och den överordnade zonens NS-delegering. Behåll den gamla zonen under övergången.

När Cloudflare ser rätt delegering blir zonen aktiv. Kontrollera med flera rekursiva resolverare och direkt mot båda nya auktoritativa namnservrarna. Vanliga cachelagrade svar kan leva kvar under sin återstående TTL.

## Exempel: GitHub Pages som webbhost

Lägg till den egna domänen under rätt repos **Settings → Pages → Custom domain** innan DNS pekas till GitHub Pages. Annars finns risk att en oregistrerad domän kan kopplas till någon annans sida. Domänverifiering under GitHub-kontots Pages-inställningar ger ytterligare ägarskydd.

För en apexdomän anger GitHub vid denna kontroll följande A-poster:

| Typ | Namn | Värde |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | kontonamn.github.io |

CNAME-värdet är kontots värdnamn, utan repo eller sökväg. Ersätt gamla konkurrerande A/AAAA/CNAME-poster för samma webbnamn. Ändra inte fungerande e-postposter.

Börja med DNS-only om GitHub behöver se ursprungsadresserna för kontroll och certifikatutgivning. Vänta på ett giltigt certifikat för både huvuddomänen och alternativet med eller utan `www`. Slå på **Enforce HTTPS** när GitHub erbjuder det. Certifikatutgivning kan ta upp till ett dygn.

Om Cloudflares proxy ska användas: aktivera den först när edge-certifikatet och origin-certifikatet är klara, och använd **Full (strict)**. Använd inte Flexible som genväg runt ett certifikatfel. Kontrollera att HTTP omdirigeras till HTTPS utan loopar och att proxy/cache inte stör JSON-uppdateringar eller publicering.

För en egen GitHub Actions-publicering ska basvägen komma från `actions/configure-pages` eller uttrycklig domänkonfiguration. GitHubs egna arbetsflöden hanterar `CNAME` annorlunda än grenbaserad publicering: en `CNAME`-fil är inte det som konfigurerar en Actions-publicerad sajt.

## Återaktivera DNSSEC

Cloudflare rekommenderar återaktivering först när namnserverbytet har slagit igenom och DNS fungerar genom den nya leverantören. Avsätt minst den tidigare NS-delegeringens fulla TTL och kontrollera resultatet innan den nya DS-posten publiceras. Denna väntan är separat från den tidigare väntan på att den gamla DS-posten ska löpa ut. Ett grönt svar från en enskild resolver bevisar inte att gamla delegeringar har försvunnit överallt. Läs den nya signeringens **Key tag**, **Algorithm**, **Digest type** och **Digest** från just den zonen. Se [Cloudflares kontroll efter flytt](https://developers.cloudflare.com/learning-paths/dns-best-practices/concepts/phase-4/).

För externa namnservrar och `.se`/`.nu` låter Loopia dig ange dessa värden under domänens DNSSEC-inställning. Lägg in Cloudflares nya värden, inte den gamla leverantörens. Spara och invänta att den nya DS-posten syns hos registret.

Kontrollera att DS matchar Cloudflares uppgifter och att DNSSEC-validerande resolverare lämnar normala svar med verifierad kedja. Cloudflares DNSSEC-status ska vara aktiv. Skriv inte ”DNSSEC klart” enbart för att en knapp tryckts.

## Slutkontroll och överlämning

Kontrollera de verkliga publika adresserna efter ompekningen:

- Huvuddomän över HTTPS, utan certifikatvarning.
- HTTP och `www` leder till vald huvuddomän utan omdirigeringsloop.
- Gamla delade länkar öppnar motsvarande sida och bevarar urvalet.
- Svenska och engelska sidor, direktlänkar och omladdning fungerar.
- Skript, bilder, lokala API-resurser och nya publiceringar laddar korrekt.
- Canonical, hreflang, sitemap, robots och delningsbilder använder rätt domän.
- Favikon, Apple touch icon, manifest och hemskärmsapp visar rätt varumärke.
- Mobil och dator är visuellt kontrollerade. Faktisk iPhone/PWA ska skiljas från browseremulering.
- E-postposter är oförändrade och DNSSEC-kedjan är verifierad.

Registrera slutligt commit-id, lyckad publiceringskörning, domänkonfiguration, namnservrar, tidpunkt och verifierade HTTP/DNS-resultat i projektets överlämning. Lägg aldrig in lösenord, sessionskakor eller hemliga nycklar i guiden.

Aktivera en återkommande kontroll utanför den egna webbhosten och kör den efter publicering. Den ska kontrollera DNS/DNSSEC, vanlig HTTPS-åtkomst, rätt innehåll och omdirigeringar med bevarad sökväg. En parkeringssida kan ge HTTP 200. Politicalverse använder [den dokumenterade domänkontrollen](domain-health.md); testa både fel och återhämtning och verifiera att schemat faktiskt körs.

Skilj alltid en direkt kontroll av rätt server från vanlig åtkomst via nätets DNS. `curl --resolve` kan verifiera innehåll och TLS hos Cloudflare eller ursprunget, men bevisar inte att besökarnas vanliga uppslag når den servern. Kontrollera även HTTPS utan `--resolve` och i en ny webbläsarflik på den vanliga domänen. Om någon kontrollerad åtkomst fortfarande visar parkering eller DNS-fel ska det framgå som en öppen lanseringsavvikelse.

Vid avvikelse: spara tidsstämplade svar för NS, DS, A och AAAA från överordnad zon, gamla och nya auktoritativa namnservrar, flera publika resolverare och det drabbade nätet. Kontrollera både apex, `www` och gamla wildcard-poster. Registrera status, TTL och SOA-serie; ett NODATA-svar är inte samma sak som timeout eller SERVFAIL. Dra inte slutsatsen att ett namnserverbyte är återställt enbart för att en gammal adress finns i cache. Lova heller inte att allt är klart när endast en uppsättning DNS-svar är rätt. En gammal delegering kan förnya adressposter, så återstående TTL för en enda A-post är inte alltid hela övergångstiden.

Om något behöver återställas, utgå från den sparade DNS-exporten och rätt tidigare publicering. Ett namnserverbyte tillbaka kräver att DNSSEC-kedjan samtidigt passar den återställda leverantören. Gamla och nya signerare kan inte bytas godtyckligt medan fel DS-post ligger kvar hos registret.

## Leverantörernas anvisningar

- [Loopia: byt namnservrar](https://support.loopia.se/wiki/byt-namnservrar/)
- [Loopia: DNSSEC och externa namnservrar](https://support.loopia.se/wiki/information-om-dnssec/)
- [Cloudflare: DNSSEC](https://developers.cloudflare.com/dns/dnssec/)
- [GitHub: koppla egen domän](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub: verifiera domänägarskap](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
