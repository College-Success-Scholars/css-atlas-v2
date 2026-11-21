"use client";

import Link from "next/link";
import {
  ScholarDataTable,
  type ScholarDataTableColumn,
} from "@/components/data-display/scholar-data-table";
import type { DataTableFilter } from "@/components/data-display/data-table";
import { Badge } from "@/components/ui/badge";
import type { MemoUserRow } from "@css-atlas/shared/contracts/users";

function displayName(row: MemoUserRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return name || (row.first_name ?? row.last_name ?? "—");
}

function isActiveMember(row: MemoUserRow): boolean {
  return (row.status ?? "").toLowerCase() === "enrolled";
}

const statusFilterBar: DataTableFilter<MemoUserRow>[] = [
  {
    field: "status",
    placeholder: "Show",
    options: [{ label: "Active members only", value: "enrolled" }],
    matchFn: (row, selected) => {
      if (selected.includes("enrolled")) return isActiveMember(row);
      return true;
    },
  },
];

export function ProfilesUserTable({ users }: { users: readonly MemoUserRow[] }) {
  const columns: ScholarDataTableColumn<MemoUserRow>[] = [
    {
      id: "name",
      header: "Name",
      field: "uid",
      sortable: true,
      getSortValue: (row) => displayName(row).toLowerCase(),
      renderCell: (row) => (
        <Link
          href={`/dev/profiles/${row.uid}`}
          className="text-primary hover:underline font-medium"
        >
          {displayName(row)}
        </Link>
      ),
    },
    {
      id: "uid",
      header: "UID",
      field: "uid",
      cellClassName: "font-mono text-sm",
      sortable: true,
    },
    {
      id: "cohort",
      header: "Cohort",
      field: "cohort",
      sortable: true,
      renderCell: (row) => row.cohort ?? "—",
    },
    {
      id: "program_role",
      header: "Program role",
      field: "program_role",
      sortable: true,
      renderCell: (row) => (
        <Badge
          variant={
            (row.program_role ?? "").toLowerCase() === "scholar"
              ? "default"
              : "secondary"
          }
        >
          {row.program_role ?? "—"}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      field: "status",
      sortable: true,
      renderCell: (row) => {
        const status = (row.status ?? "").toLowerCase();
        return (
          <Badge variant={status === "enrolled" ? "default" : "secondary"}>
            {row.status ?? "—"}
          </Badge>
        );
      },
    },
  ];

  return (
    <ScholarDataTable<MemoUserRow>
      data={users}
      rowKeyField="uid"
      columns={columns}
      filterBar={statusFilterBar}
      defaultSortColumnId="name"
      defaultSortDirection="asc"
      emptyMessage="No users found."
      rowDataAttributes={(row) => ({ "data-uid": row.uid })}
    />
  );
}
