import current from "./messages-current.json";
import core from "./messages-core.json";
import ui from "./messages-ui.json";
import live from "./messages-live.json";
import context from "./messages-context.json";
import model from "./messages-model.json";
export type Locale = "sv" | "en";
export const messages = [
  ["mandat i det fastställda resultatet · majoritet kräver 175", "seats in the final result · a majority requires 175"],
  ["/ 349 mandat i valresultatet", "/ 349 seats in the election result"],
  ["Prognos mot utfall", "Forecast vs outcome"],
  ["Jämför det fastställda valresultatet med prognosen före valet.", "Compare the final election result with the pre-election forecast."],
  ["Valresultat 2026", "Election results 2026"],
  ["Scenarier börjar i det fastställda valresultatets fördelning mellan valkretsarna. När du ändrar en andel behålls partiets geografiska mönster från den resultatversionen.", "Scenarios start from the final election result’s constituency distribution. When you change a share, the party’s geographic pattern from that result is retained."],
  ["Utgångsläget återger det fastställda valresultatet. Ett ändrat scenario är din egen beräkning och påverkar inte de officiella resultaten.", "The baseline reproduces the final election result. An edited scenario is your own calculation and does not affect official results."],
  ["Ansluten · räknade personröster", "Connected · counted personal votes"],
  ["Signerade personröster fyller profiler, topplistor och delningsbilder för 2026 när områdets alla distrikt är räknade. Räknade och fastställda resultat märks separat. Personröster summeras över valsedlar och kontrolleras mot källans kandidattotaler. CSV-registret används bara för personkopplingar.", "Signed personal votes populate 2026 profiles, leaderboards and sharing images once all districts in the area are counted. Counted and final results are labelled separately. Personal votes are summed across ballots and checked against source candidate totals. The CSV register is used only for identity linking."],
  ["Integritet", "Privacy"],
  ["Folkpartiet liberalerna", "Liberal People’s Party"],
  ["Topplistor", "Leaderboards"],
  ["Personröster och kandidathistorik 2010–2022", "Personal votes and candidate histories 2010–2022"],
  ["XML + XLSX + CSV · fyra ordinarie val", "XML + XLSX + CSV · four regular elections"],
  ["Officiella personröster i riksdags-, region- och kommunval. Originalarkiv, samlade kandidatprofiler och topplistor. Kopplingar över val är beräknade och osäkra identiteter hålls separata.", "Official personal votes in Riksdag, regional and municipal elections. Original archives, candidate profiles and leaderboards. Cross-election links are derived and uncertain identities stay separate."],...current, ...core, ...ui, ...live, ...context, ...model] as Array<[string, string]>;
