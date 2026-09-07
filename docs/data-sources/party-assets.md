# Parliamentary party asset provenance

Politicalverse stores party identity assets locally so the product does not hotlink third-party artwork. The files are used only to identify parties in neutral election-analysis interfaces. Party names and logos may be protected trademarks; ownership remains with the respective parties.

Acquired on 2026-08-21. SHA-256 values pin the exact checked-in files.

| Party | Local file | Publisher page | Direct source | SHA-256 |
| --- | --- | --- | --- | --- |
| Socialdemokraterna | `public/parties/s.png` | [Official press page](https://www.socialdemokraterna.se/vart-parti/press/) | Official 2024 logo package, red symbol without text | `852d433c4a515ed161ab2b5a66e7d0e93157ead11fae3aabaf18a761419db737` |
| Sverigedemokraterna | `public/parties/sd.png` | [Official press page](https://www.sd.se/press/) | `https://www.sd.se/wp-content/uploads/2022/07/logo_sd_logo_blasippa.png` | `7849f25e11e989ea892afa8bc24ab2c32bd724ab84ede747ee695e8ca50cf1a9` |
| Moderaterna | `public/parties/m.png` | [Official Via TT press room](https://via.tt.se/pressrum/3235744/moderaterna/m) | `https://via.tt.se/data/images/00807/95e5a5f4-a985-4d42-a12a-2137a674bda5.png` | `1d5f4ffc245f9b1013316f5bee17958ca2e6674287d9f5ae4c60b29950803fa4` |
| Vänsterpartiet | `public/parties/v.png` | [Official graphic profile](https://www.vansterpartiet.se/grafisk-profil/) | Official linked logo package, transparent web PNG | `ca417e3900f7fc36b336cc4e84fa3f173cce569818a9ecdb173b18b1d307be60` |
| Centerpartiet | `public/parties/c.png` | [Official graphic profile](https://www.centerpartiet.se/om-centerpartiet/grafisk-profil) | `https://www.centerpartiet.se/images/18.1f0bd54219afcc2a05ec70b/1765454690885/Centerpartiet_partisymbol_klover_bordered.png` | `ebc632a7a4f010d7ef12a1500d4bf1c20b06424c3b3377c39ac8387c96cd4fdd` |
| Kristdemokraterna | `public/parties/kd.png` | [Official press kit](https://press.kristdemokraterna.se/presskits/25663/logotyp-rund-variant-undantag-bara-i-media) | Official media-use color PNG | `be16c4c8b5f7f1dbf6ba7aa7a427e98cb219f10c1dfaff6e4c6b38cb33097d1a` |
| Miljöpartiet | `public/parties/mp.png` | [Official profile and logo page](https://www.mp.se/profil-och-logga/) | Official site application icon containing the party symbol | `58ef4b518d9a8ce2b8669ee61ed212f2003a20cdf3b3b28b4c6c152b04ea94ba` |
| Liberalerna | `public/parties/l.png` | [Official graphic profile](https://www.liberalerna.se/grafisk-profil) | Official linked digital-logo package, round PNG | `a9ee036ef5dea4e093cad9bc7ee8331112042a4067c2fb532ad6de60c35c47ed` |

Do not replace these files silently. Record a new acquisition date, source, and checksum when a party publishes a revised identity.

## Display rules

Use `PartyMark` for compact party labels throughout the product, including candidate histories, rankings, selectors, tables and live results. `PartyGroup` and `PartyText` identify parties in bloc lists and political copy; translate complete sentences before inserting logos. Do not apply text substitution to personal names, source identifiers, URLs or native form values. Native select options retain full party names.

Other parties and named local parties remain plain text, without an invented badge. All eight logos retain their colors on a white ground in both themes. Accessible names identify the party in the selected language. Historical views use these current identity symbols, with the historical Folkpartiet liberalerna name through 2014; the artwork is not claimed to be historical. SVG chart labels use the same local assets and leader lines to the unchanged data endpoints.
