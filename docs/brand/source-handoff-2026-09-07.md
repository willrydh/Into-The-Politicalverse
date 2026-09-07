# Till chatten som publicerar loggan

Användaren har valt **kronan med ett utskuret nordiskt kors**. Det är den här loggan som ska användas, inklusive som ikon när webbplatsen sparas på hemskärmen.

## Filer

- `politicalverse-logo.svg`: skalbar logga med rundad blå bakgrund och transparenta hörn, för sajtens header och footer.
- `politicalverse-logo.png`: samma logga, 512 × 512.
- `politicalverse-mark.svg`: endast den gula kronan, med transparent bakgrund och transparent kors.
- `politicalverse-app-icon.svg`: fyrkantig originalikon med heltäckande blå bakgrund.
- `politicalverse-app-icon-180.png`: Apple touch icon.
- `politicalverse-app-icon-192.png` och `politicalverse-app-icon-512.png`: webbmanifest, purpose "any".
- `politicalverse-app-icon-maskable-512.png`: extra marginal för webbmanifest, purpose "maskable".
- `politicalverse-app-icon-1024.png`: stor appikon.
- `favicon-16.png`, `favicon-32.png`, `favicon-48.png`: små webbläsarikoner.

Appfilerna har fyrkantig, heltäckande bakgrund. Operativsystemet sköter hörnmaskningen.

## Exakta färger

- Huvudblå: **#0C3D59**
- Kronans gula: **#FFD145**
- Vid behov mörkare blå sekundäryta: **#092E43**

Matcha sajtens primära blå ytor och blå länkar i ljust tema med #0C3D59. Behåll ljus textkontrast i mörkt tema. Ändra inte partiernas färger eller datagrafikens betydelse.

## Sajt och införande

Repo: https://github.com/willrydh/Into-The-Politicalverse
Sajt: https://willrydh.github.io/Into-The-Politicalverse/

Åtkomst till rätt repo kontrollerades i den här chatten: den anslutna GitHub-användaren har push/admin. Den andra chatten behöver verifiera sin egen tillgängliga anslutning.

Sajten är Next.js med statisk export och GitHub Pages-basepath /Into-The-Politicalverse. Följ repoets AGENTS.md, README.md och CODEX_HANDOFF.md. Befintlig GitHub Pages-workflow är publiceringsvägen.

Ersätt PV-symbolen i components/site-header.tsx och components/site-footer.tsx. Behåll det befintliga textnamnet ”Into the Politicalverse” och den redaktionella serifen; ordmärket ska fortsätta vara riktig webbtext. Ta bort den gamla symbolens hörndekoration i .wordmark__mark.

Uppdatera huvudblå tokens i app/globals.css, särskilt --brand-surface och --blue i ljust tema. Bevara mörkt temas läsbara textfärger. Lägg till favicon, Apple touch icon och webbmanifest i båda språkens metadata; alla URL:er måste fungera med GitHub Pages-basepath. Kontrollera appikon, mobil header och båda temana.

**Ingen ändring har publicerats till sajten i den här leveransen.** Loggpaketet är färdigt att lämna vidare.

## Framtagning

Konceptet skapades med det inbyggda imagegen-verktyget. De levererade produktionsfilerna är en ren vektorisering av den valda kronan; alla PNG-filer är renderade från samma SVG-former för exakta färger och konsekventa storlekar. Bildprompten finns i BILDPROMPT.md.

