const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateStamp(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const epoch = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value;
}

export function isoDateToEpoch(value: string): number {
  if (!isIsoDateStamp(value)) throw new Error(`Invalid ISO date ${value}`);
  return Date.parse(`${value}T00:00:00.000Z`);
}

export function dateInTimeZone(date: Date, timeZone: string): string {
  if (!Number.isFinite(date.getTime())) throw new Error("Cannot format an invalid date");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const result = `${values.year}-${values.month}-${values.day}`;
  if (!isIsoDateStamp(result)) throw new Error(`Could not resolve a calendar date in ${timeZone}`);
  return result;
}
