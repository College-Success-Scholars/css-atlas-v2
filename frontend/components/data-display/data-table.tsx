/**
 * @file data-table.tsx
 * @module frontend/components
 *
 * Generic reusable sortable and filterable data table component.
 * Built on TanStack Table (react-table) with shadcn/ui table primitives.
 * Supports column sorting, text filtering, expandable rows, pagination, and optional row activation.
 *
 * ## What belongs here
 * - Generic data table logic applicable across multiple domains
 *
 * ## What does NOT belong here
 * - Domain-specific column definitions (those live in the pages or components that use this table)
 * - Data fetching
 */
"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * DataTable – generic table component with optional sorting and filtering.
 *
 * Features:
 * - Declarative column config with custom `renderCell` and sort logic
 * - Optional per-column sorting via `sortable`, `getSortValue`, or `compareFn`
 * - Optional filter bar with single- or multi-select dropdowns
 * - Optional name/uid shorthand columns for scholar-like data
 */

/** One column definition. */
export interface DataTableColumn<T> {
  id: string;
  header: string;
  /** Field key used for cell display (and for sort when sortable if sortField not set). */
  field: keyof T;
  /** Optional fallback field for display when field is null/undefined. */
  fallbackField?: keyof T;
  /** When sortable, use this field for comparison (defaults to field). */
  sortField?: keyof T;
  colSpan?: number;
  width?: string;
  cellClassName?: string;
  sortable?: boolean;
  /** Custom cell renderer. */
  renderCell?: (row: T) => React.ReactNode;
  /** Custom sort value extractor (single-field comparison). */
  getSortValue?: (row: T) => string | number;
  /** Full custom comparator. Overrides default sort for this column. Return negative/0/positive. */
  compareFn?: (a: T, b: T) => number;
}

/** Config for nameColumn / uidColumn shorthand. */
export interface DataTableColumnConfig<T> {
  header?: string;
  field: keyof T;
  fallbackField?: keyof T;
  sortField?: keyof T;
  colSpan?: number;
  width?: string;
  cellClassName?: string;
  sortable?: boolean;
}

/** One filter definition for the optional filter bar. */
export interface DataTableFilter<T> {
  /** Field to filter on. The row's field value is coerced to string for comparison. */
  field: keyof T;
  /** Available filter options. */
  options: { label: string; value: string }[];
  /** Placeholder / label shown when nothing is selected. */
  placeholder?: string;
  /** Allow selecting multiple values. Default false. */
  multi?: boolean;
  /** Custom match function. Receives the row and selected filter values. Overrides default equality check. */
  matchFn?: (row: T, selected: string[]) => boolean;
}

interface DataTableProps<T> {
  data: T[];
  /** Field key used to generate row keys (e.g. "scholarUid"). */
  rowKeyField: keyof T;
  /** Name column shorthand. Uses header default "Scholar". */
  nameColumn?: DataTableColumnConfig<T>;
  /** UID column shorthand. Uses header default "UID". */
  uidColumn?: DataTableColumnConfig<T>;
  /** Extra columns (when using name/uid), or full column list otherwise. */
  columns?: DataTableColumn<T>[];
  /** Optional filter bar rendered above the table. */
  filterBar?: DataTableFilter<T>[];
  emptyMessage?: string;
  className?: string;
  /** Initial sort column id. Must match a resolved column id. */
  defaultSortColumnId?: string;
  /** Initial sort direction. Defaults to "asc". */
  defaultSortDirection?: "asc" | "desc";
  /** Optional data attributes to render on each <tr>. */
  rowDataAttributes?: (row: T) => Record<string, string>;
  /** When set, rows are focusable and open on click, Enter, or Space. */
  onRowActivate?: (row: T) => void;
  /** Accessible label for an activatable row. */
  getRowLabel?: (row: T) => string;
}

function toColumn<T>(
  id: string,
  header: string,
  config: DataTableColumnConfig<T>
): DataTableColumn<T> {
  return {
    id,
    header,
    field: config.field,
    fallbackField: config.fallbackField,
    sortField: config.sortField,
    colSpan: config.colSpan,
    width: config.width,
    cellClassName: config.cellClassName,
    sortable: config.sortable,
  };
}

function getCellDisplay<T>(row: T, col: DataTableColumn<T>): string {
  const val = row[col.field];
  if (val != null && val !== "") return String(val);
  if (col.fallbackField) {
    const fallback = row[col.fallbackField];
    if (fallback != null) return String(fallback);
  }
  return "";
}

function getDefaultSortValue<T>(row: T, col: DataTableColumn<T>): string | number {
  if (col.getSortValue) return col.getSortValue(row);
  const key = col.sortField ?? col.field;
  const val = row[key];
  if (typeof val === "number") return val;
  if (typeof val === "string") return val;
  if (val != null) return String(val);
  return "";
}

type SortDirection = "asc" | "desc";

type SortState = { columnId: string | null; direction: SortDirection };

export function DataTable<T>({
  data,
  rowKeyField,
  nameColumn,
  uidColumn,
  columns = [],
  filterBar,
  emptyMessage = "No records",
  className,
  defaultSortColumnId,
  defaultSortDirection = "asc",
  rowDataAttributes,
  onRowActivate,
  getRowLabel,
}: DataTableProps<T>) {
  const [sortState, setSortState] = useState<SortState>({
    columnId: defaultSortColumnId ?? null,
    direction: defaultSortDirection,
  });
  const { columnId: sortColumnId, direction: sortDirection } = sortState;

  // Filter state: map of field → selected value(s)
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});

  const hasNameUid = nameColumn != null || uidColumn != null;
  const resolvedColumns: DataTableColumn<T>[] = useMemo(() => {
    return hasNameUid
      ? [
        ...(nameColumn
          ? [
            toColumn<T>("name", nameColumn.header ?? "Scholar", {
              ...nameColumn,
              colSpan: nameColumn.colSpan ?? 2,
            }),
          ]
          : []),
        ...(uidColumn
          ? [toColumn<T>("uid", uidColumn.header ?? "UID", uidColumn)]
          : []),
        ...columns,
      ]
      : columns;
  }, [hasNameUid, nameColumn, uidColumn, columns]);

  // Apply filters
  const filteredData = useMemo(() => {
    if (!filterBar || filterBar.length === 0) return data;
    return data.filter((row) => {
      return filterBar.every((filter) => {
        const selected = filterValues[String(filter.field)];
        if (!selected || selected.length === 0) return true;
        if (filter.matchFn) return filter.matchFn(row, selected);
        const rowVal = String(row[filter.field] ?? "");
        return selected.includes(rowVal);
      });
    });
  }, [data, filterBar, filterValues]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (sortColumnId == null) return filteredData;
    const col = resolvedColumns.find((c) => c.id === sortColumnId);
    if (!col?.sortable) return filteredData;
    const mult = sortDirection === "asc" ? 1 : -1;

    if (col.compareFn) {
      return [...filteredData].sort((a, b) => col.compareFn!(a, b) * mult);
    }

    return [...filteredData].sort((a, b) => {
      const va = getDefaultSortValue(a, col);
      const vb = getDefaultSortValue(b, col);
      if (va < vb) return -1 * mult;
      if (va > vb) return 1 * mult;
      return 0;
    });
  }, [filteredData, sortColumnId, sortDirection, resolvedColumns]);

  const handleSort = (columnId: string) => {
    const col = resolvedColumns.find((c) => c.id === columnId);
    if (!col?.sortable) return;
    setSortState((prev) => {
      if (prev.columnId === columnId) {
        if (prev.direction === "asc") return { columnId, direction: "desc" };
        return { columnId: null, direction: "asc" };
      }
      return { columnId, direction: "asc" };
    });
  };

  const handleFilterChange = (field: string, value: string, multi: boolean) => {
    setFilterValues((prev) => {
      if (!multi) {
        // Single select: toggle on/off
        const current = prev[field];
        if (current?.[0] === value) return { ...prev, [field]: [] };
        return { ...prev, [field]: [value] };
      }
      // Multi select: toggle individual value
      const current = prev[field] ?? [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter((v) => v !== value) };
      }
      return { ...prev, [field]: [...current, value] };
    });
  };

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{emptyMessage}</p>
    );
  }

  const cellClass = "py-2 pr-4";
  const thClass = "font-medium py-2 pr-4 text-left text-muted-foreground";
  const hasWidths = resolvedColumns.some((col) => col.width != null);

  return (
    <div className={`overflow-x-auto rounded-md text-sm ${className ?? ""}`}>
      {filterBar && filterBar.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2">
          {filterBar.map((filter) => {
            const fieldKey = String(filter.field);
            const selected = filterValues[fieldKey] ?? [];
            return (
              <div key={fieldKey} className="flex items-center gap-1.5">
                {filter.placeholder && (
                  <span className="text-xs text-muted-foreground">{filter.placeholder}</span>
                )}
                <div className="flex flex-wrap gap-1">
                  {filter.options.map((opt) => {
                    const isActive = selected.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleFilterChange(fieldKey, opt.value, filter.multi ?? false)}
                        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                          isActive
                            ? "bg-foreground text-background"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <table
        className="w-full border-collapse"
        style={hasWidths ? { tableLayout: "fixed" } : undefined}
      >
        {hasWidths && (
          <colgroup>
            {resolvedColumns.map((col) => (
              <col
                key={col.id}
                span={col.colSpan ?? 1}
                style={col.width ? { width: col.width } : undefined}
              />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {resolvedColumns.map((col) => (
              <th
                key={col.id}
                className={thClass}
                colSpan={col.colSpan ?? 1}
                data-column-id={col.id}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => handleSort(col.id)}
                    className="inline-flex items-center gap-1.5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded px-1 -mx-1 text-left"
                  >
                    {sortColumnId === col.id ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-4 shrink-0 text-muted-foreground" aria-label="Sorted ascending" />
                      ) : (
                        <ArrowDown className="size-4 shrink-0 text-muted-foreground" aria-label="Sorted descending" />
                      )
                    ) : (
                      <ArrowUpDown className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                    )}
                    {col.header}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, i) => (
            <tr
              key={`${String(row[rowKeyField])}-${i}`}
              className={`even:bg-muted/40 dark:even:bg-muted/25 ${
                onRowActivate
                  ? "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  : ""
              }`}
              {...(onRowActivate
                ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": getRowLabel?.(row),
                  onClick: () => onRowActivate(row),
                  onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowActivate(row);
                    }
                  },
                }
                : {})}
              {...(rowDataAttributes?.(row) ?? {})}
            >
              {resolvedColumns.map((col) => (
                <td
                  key={col.id}
                  className={`${cellClass} pl-4 ${col.cellClassName ?? ""}`}
                  colSpan={col.colSpan ?? 1}
                  data-column-id={col.id}
                >
                  {col.renderCell ? col.renderCell(row) : getCellDisplay(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Wraps a table section (title + content) so it can be collapsed/expanded in height.
 */
export function CollapsibleTableSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="min-w-0">
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-sm text-muted-foreground">
            {title}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Re-export old names for backward compatibility during migration
/** @deprecated Use DataTableColumn */
export type ScholarDataTableColumn<T> = DataTableColumn<T>;
/** @deprecated Use DataTableColumnConfig */
export type ScholarDataTableColumnConfig<T> = DataTableColumnConfig<T>;
/** @deprecated Use DataTable */
export const ScholarDataTable = DataTable;
