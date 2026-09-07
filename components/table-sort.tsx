"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Localize, useLocale } from "./localize";
import { sortTableRows, type SortValue, type SortDirection, type TableSort } from "@/lib/table-sort";

export type SortColumn<T> = {
  key: string;
  label: ReactNode;
  name: string;
  value: (row: T) => SortValue;
  direction?: SortDirection;
};
type SortControl<T> = { columns: readonly SortColumn<T>[]; sort: TableSort | null; choose: (key: string, direction?: SortDirection) => void };

export function useTableSort<T>(rows: readonly T[], columns: readonly SortColumn<T>[], initial: TableSort | null = null, resetKey = "") {
  const locale = useLocale();
  const [selection, setSelection] = useState({ resetKey, sort: initial });
  // Discard the old choice during render, including when revisiting a previous filter set.
  if (selection.resetKey !== resetKey) setSelection({ resetKey, sort: initial });
  const selected = selection.resetKey === resetKey ? selection.sort : initial;
  const sort = columns.some(c => c.key === selected?.key) ? selected : initial;
  const column = columns.find(c => c.key === sort?.key);
  const sorted = useMemo(() => column && sort ? sortTableRows(rows, column.value, sort.direction, locale) : [...rows], [rows, column, sort, locale]);
  function choose(key: string, direction?: SortDirection) {
    const next = columns.find(c => c.key === key);
    if (next) setSelection({ resetKey, sort: { key, direction: direction ?? (sort?.key === key ? sort.direction === "ascending" ? "descending" : "ascending" : next.direction ?? "descending") } });
  }
  return { rows: sorted, columns, sort, choose };
}

export function SortHeaders<T>({ control, as = "th", onSort }: { control: SortControl<T>; as?: "th" | "span"; onSort?: () => void }) {
  const sv = useLocale() === "sv";
  const Cell = as;
  return control.columns.map(column => {
    const active = control.sort?.key === column.key;
    const direction = active ? control.sort!.direction : undefined;
    const next = active ? direction === "ascending" ? "descending" : "ascending" : column.direction ?? "descending";
    const action = sv ? `Sortera efter ${column.name}, ${next === "ascending" ? "stigande" : "fallande"}` : `Sort by ${column.name}, ${next}`;
    return <Cell key={column.key} scope={as === "th" ? "col" : undefined} role={as === "span" ? "columnheader" : undefined} aria-sort={direction} className="sortable-column">
      <button type="button" className="table-sort-button" data-sort-key={column.key} aria-label={action} title={action} onClick={() => { control.choose(column.key); onSort?.(); }}>
        <span className="table-sort-label"><span>{column.label}</span><svg className="table-sort-icon" viewBox="0 0 12 16" width="12" height="16" aria-hidden="true" data-direction={direction}><path className="sort-up" d="m3 6 3-3 3 3"/><path className="sort-down" d="m3 10 3 3 3-3"/></svg></span>
      </button>
    </Cell>;
  });
}

/** Card layouts hide their table headings on phones; keep the same sorting available there. */
export function MobileTableSort<T>({ control, onSort, className = "" }: { control: SortControl<T>; onSort?: () => void; className?: string }) {
  const sv = useLocale() === "sv";
  return <div className={`table-sort-mobile ${className}`}><label>{sv ? "Sortera efter" : "Sort by"}<select aria-label={sv ? "Sortera tabellen efter" : "Sort table by"} value={control.sort ? `${control.sort.key}:${control.sort.direction}` : ""} onChange={e => {
    const [key, direction] = e.target.value.split(":"); control.choose(key, direction as SortDirection); onSort?.();
  }}>{!control.sort && <option value="" disabled>{sv ? "Ursprunglig ordning" : "Original order"}</option>}{control.columns.flatMap(c => (["ascending", "descending"] as const).map(d => <option key={`${c.key}:${d}`} value={`${c.key}:${d}`}>{c.name} · {d === "ascending" ? (sv ? "stigande" : "ascending") : (sv ? "fallande" : "descending")}</option>))}</select></label></div>;
}

type StaticColumn = Omit<SortColumn<never>, "value">;
type StaticRow = { key: string | number; values: Record<string, SortValue>; content: ReactNode };

/** A small client island for server-rendered archive tables; only explicit values are sortable. */
export function StaticSortableTable({ columns, rows, initial = null, className, footer }: { columns: StaticColumn[]; rows: StaticRow[]; initial?: TableSort | null; className?: string; footer?: ReactNode }) {
  const control = useTableSort(rows, columns.map(c => ({ ...c, value: (row: StaticRow) => row.values[c.key] })), initial);
  return <Localize><table className={className}><thead><tr><SortHeaders control={control}/></tr></thead><tbody>{control.rows.map(row => row.content)}</tbody>{footer}</table></Localize>;
}
