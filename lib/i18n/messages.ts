import core from "./messages-core.json";
import ui from "./messages-ui.json";
import live from "./messages-live.json";
import context from "./messages-context.json";
import model from "./messages-model.json";
export type Locale = "sv" | "en";
export const messages = [
  ["Folkpartiet liberalerna", "Liberal People’s Party"],
  ["Topplistor", "Leaderboards"],
  ["Personröster och kandidathistorik 2010–2022", "Personal votes and candidate histories 2010–2022"],
  ["XML + XLSX + CSV · fyra ordinarie val", "XML + XLSX + CSV · four regular elections"],
  ["Officiella personröster i riksdags-, region- och kommunval. Originalarkiv, samlade kandidatprofiler och topplistor. Kopplingar över val är beräknade och osäkra identiteter hålls separata.", "Official personal votes in Riksdag, regional and municipal elections. Original archives, candidate profiles and leaderboards. Cross-election links are derived and uncertain identities stay separate."],...core, ...ui, ...live, ...context, ...model] as Array<[string, string]>;
