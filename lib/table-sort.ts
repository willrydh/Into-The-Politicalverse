export type SortValue = string | number | boolean | null | undefined;
export type SortDirection = "ascending" | "descending";
export type TableSort = { key: string; direction: SortDirection };

/** Sort source values, never formatted cells. Missing observations stay last in either direction. */
export function sortTableRows<T>(rows: readonly T[], value: (row: T) => SortValue, direction: SortDirection, locale: string): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const missing = (v: SortValue) => v === null || v === undefined || typeof v === "number" && !Number.isFinite(v);
  return rows.map((row, index) => ({ row, index, value: value(row) })).sort((a, b) => {
    const am = missing(a.value), bm = missing(b.value);
    if (am || bm) return am === bm ? a.index - b.index : am ? 1 : -1;
    const order = typeof a.value === "string" && typeof b.value === "string"
      ? collator.compare(a.value, b.value) : Number(a.value) - Number(b.value);
    return (direction === "ascending" ? order : -order) || a.index - b.index;
  }).map(({ row }) => row);
}
