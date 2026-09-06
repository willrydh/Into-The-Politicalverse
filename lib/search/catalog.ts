import { bilingual as b, type SearchEntry } from "./types";

export const SEARCH_PAGES = [
  { route: "", title: b("Start · Valprognos 2026", "Home · Election forecast 2026"), description: b("Översikt över prognosen, mandat och vägar till fördjupning.", "Forecast overview, seats and paths to further analysis.") },
  { route: "forecasts", title: b("Prognos 2026", "Forecast 2026"), description: b("Opinionsmätningar, sannolikheter, mandatintervall och regeringsbildning.", "Opinion polls, probabilities, seat intervals and government formation.") },
  { route: "maps", title: b("Karta och lokala valresultat", "Map and local election results"), description: b("Län, kommuner, valdistrikt, historik och personröster.", "Counties, municipalities, districts, history and personal votes.") },
  { route: "parties", title: b("Partier", "Parties"), description: b("Partiernas röster, mandat och geografiska styrka över tid.", "Party votes, seats and geographic strength over time.") },
  { route: "elections", title: b("Valarkiv · block och regeringar", "Election archive · blocs and governments"), description: b("Riksdagsvalen 2002–2022, blockens mandat och regeringen efter varje val.", "Riksdag elections 2002–2022, bloc seats and the government after each election.") },
  { route: "charts", title: b("Grafer och valdata", "Charts and election data"), description: b("Historisk nationell röstandel och underliggande tabeller.", "Historical national vote share and underlying tables.") },
  { route: "indicators", title: b("Indikatorer och statistik", "Indicators and statistics"), description: b("Swing, relativ styrka, valdeltagande och geografisk bredd.", "Swing, relative strength, turnout and geographic breadth.") },
  { route: "simulator", title: b("Valsimulator", "Election simulator"), description: b("Ändra röstandelar och undersök mandat, spärrar och koalitioner.", "Change vote shares and explore seats, thresholds and coalitions.") },
  { route: "valnatt", title: b("Valnatt 2026", "Election night 2026"), description: b("Officiell rösträkning, förtidsröster, röstberättigade och datastatus.", "Official counting, early voting, eligible voters and data status.") },
  { route: "sources", title: b("Datakällor", "Data sources"), description: b("Källregister, datatäckning och ursprung för sajten.", "Source catalogue, data coverage and provenance for the site.") },
];

const topics = [
  ["personal", "/maps/?year=2022#personal-votes", "Personröster och kandidater", "Personal votes and candidates", "Personval, kandidatlistor, utlandsröster och femprocentspärren i riksdagsvalkretsen.", "Personal voting, candidate lists, overseas votes and the five-percent constituency threshold."],
  ["questions", "/forecasts/#fragor", "Prognosfrågor", "Forecast questions", "Största parti, riksdagsspärren och koalitionernas mandat.", "Largest party, parliamentary threshold and coalition seats."],
  ["seats", "/forecasts/#partier", "Röstprognos och mandatintervall", "Vote forecast and seat intervals", "Partiernas osäkerhet och fördelning av mandat.", "Party uncertainty and distribution of seats."],
  ["government", "/forecasts/#regering", "Regeringsbildning och partiledare", "Government formation and party leaders", "Statsminister, negativ parlamentarism, Tidöavtalet och deklarerade regeringslinjer.", "Prime minister, negative parliamentarism, Tidö agreement and declared government positions."],
  ["history", "/forecasts/#historik", "Prognosens utveckling", "Forecast history", "Hur mandatprognosen har förändrats över tid.", "How the seat forecast has changed over time."],
  ["backtest", "/forecasts/#backtest", "Historisk kontroll av prognosen", "Historical forecast validation", "Backtest, kalibrering och historiska prognosfel.", "Backtesting, calibration and historical forecast errors."],
  ["method", "/forecasts/#metod", "Prognosmetod och dataintegritet", "Forecast methodology and data integrity", "Opinionsmätningar, vikter, halveringstid, Monte Carlo, källor och begränsningar.", "Opinion polls, weights, half-life, Monte Carlo, sources and limitations."],
  ["simulator-method", "/simulator/#simulator-method-title", "Så beräknas riksdagsmandaten", "How Riksdag seats are calculated", "Jämkade uddatalsmetoden, fasta mandat, utjämningsmandat och valkretsar.", "Modified Sainte-Laguë method, fixed seats, adjustment seats and constituencies."],
];
export const SEARCH_TOPICS: SearchEntry[] = topics.map(([id, href, sv, en, svDescription, enDescription]) => ({ id: `topic:${id}`, type: "topic", href, title: b(sv, en), description: b(svDescription, enDescription) }));
