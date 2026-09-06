import { isIsoDateStamp } from "../dates";

export function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function object(value: unknown, label: string): Record<string, unknown> {
  insist(value !== null && typeof value === "object" && !Array.isArray(value), `${label}: expected object`);
  return value as Record<string, unknown>;
}
export function list(value: unknown, label: string): unknown[] {
  insist(Array.isArray(value), `${label}: expected array`);
  return value;
}
export function integer(value: unknown, label: string): number {
  insist(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, `${label}: expected non-negative safe integer`);
  return value;
}
export function string(value: unknown, label: string): string {
  insist(typeof value === "string" && value.trim().length > 0, `${label}: expected non-empty string`);
  return value;
}
export function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator * 100;
}
export function checkRoundedPercent(value: unknown, actual: number | null, label: string): void {
  if (actual === null) { insist(value === null || value === 0, `${label}: nonzero percentage without denominator`); return; }
  insist(typeof value === "number" && Number.isFinite(value) && Math.abs(value - actual) <= 0.051, `${label}: percentage denominator mismatch`);
}

/** Valmyndigheten timestamps without offset are Swedish local time, not runner UTC. */
export function sourceTimestamp(value: unknown): string {
  const text = string(value, "source timestamp");
  insist(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(text) && isIsoDateStamp(text.slice(0, 10)), "Invalid Swedish source timestamp");
  const local = Date.parse(`${text}Z`);
  insist(Number(text.slice(11, 13)) < 24 && Number(text.slice(14, 16)) < 60 && Number(text.slice(17, 19)) < 60, "Invalid source clock time");
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(local)).map(p => [p.type, p.value]));
  const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  return new Date(local - (represented - Math.floor(local / 1000) * 1000)).toISOString();
}
