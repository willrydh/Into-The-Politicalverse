import forecastJson from "@/data/normalized/election-forecast-2026.json";
import type { ElectionForecast } from "./types";

export const electionForecast = forecastJson as unknown as ElectionForecast;
