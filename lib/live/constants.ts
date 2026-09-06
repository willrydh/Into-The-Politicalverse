import type { SimulatorPartyId } from "../simulator/types";

export const LIVE_ADAPTER_VERSION = "pv-valmyndigheten-live-1.0.0";
export const CERTIFICATE_SHA256 = "084c0b29d5a12fe89f2bf115e68a605e59c4dc03ecbde55e8d959669cc1fd048";
export const PARTY_CODE_TO_ID: Record<string, SimulatorPartyId> = { "0001": "M", "0002": "S", "0003": "L", "0004": "C", "0005": "V", "0055": "MP", "0068": "KD", "0110": "SD" };
