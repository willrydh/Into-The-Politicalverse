import type { ElectionForecast } from "./types";

export const coalitionDefinitions: Array<Omit<ElectionForecast["coalitions"][number], "centralSeats" | "majorityProbability">> = [
    {
      id: "opposition-four",
      name: "S + V + MP + C",
      partyIds: ["S", "V", "MP", "C"],
      status: "politically-contested",
      explanation: "Mandaten kan räcka, men C säger nej till V i regering. Majoritet är därför inte samma sak som en färdig koalition.",
    },
    {
      id: "red-green-three",
      name: "S + V + MP",
      partyIds: ["S", "V", "MP"],
      status: "arithmetical",
      explanation: "Mandat för tre rödgröna partier. Modellen antar inte att andra partier tolererar regeringen.",
    },
    {
      id: "andersson-center",
      name: "S + C + MP",
      partyIds: ["S", "C", "MP"],
      status: "politically-contested",
      explanation: "Ett Andersson-underlag utan V i regeringen; det behöver normalt stöd eller tolerans utifrån.",
    },
    {
      id: "center-crossbloc",
      name: "S + C + KD",
      partyIds: ["S", "C", "KD"],
      status: "politically-contested",
      explanation: "C har pekat på en sådan mittlösning, men partierna har inte en gemensam regeringsöverenskommelse.",
    },
    {
      id: "tido-four",
      name: "M + SD + KD + L",
      partyIds: ["M", "SD", "KD", "L"],
      status: "declared",
      explanation: "De fyra Tidöpartiernas mandatbas. Det här är en mandatprognos, inte ett färdigt regeringsbeslut.",
    },
    {
      id: "tido-without-l",
      name: "M + SD + KD",
      partyIds: ["M", "SD", "KD"],
      status: "arithmetical",
      explanation: "Visar mandatläget utan L; det är inte ett separat deklarerat regeringsalternativ.",
    },
  ];
