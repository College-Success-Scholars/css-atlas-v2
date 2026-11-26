"use client";

import {
  ScholarDataTable,
  type ScholarDataTableColumn,
} from "@/components/data-display/scholar-data-table";
import { ProgressCell } from "@/components/data-display/progress-cell";
import type { TeamLeaderFormStatsRow } from "@css-atlas/shared/contracts/form-logs";

export function TeamLeadersTable({
  rows,
}: {
  rows: readonly TeamLeaderFormStatsRow[];
}) {
  const programRoleOrder = [
    "Program Coordinator",
    "President",
    "Vice President",
    "E-Board Chair",
    "Team Leader II",
    "Team Leader I",
  ];

  const columns: ScholarDataTableColumn<TeamLeaderFormStatsRow>[] = [
    {
      id: "program_role",
      header: "Program role",
      width: "16%",
      field: "programRole",
      cellClassName: "text-muted-foreground",
      sortable: true,
      getSortValue: (row) => {
        const role = row.programRole ?? "";
        const idx = programRoleOrder.indexOf(role);
        return idx >= 0 ? idx : programRoleOrder.length;
      },
    },
    {
      id: "wahf-progress",
      header: "WAHF",
      width: "16%",
      field: "wahfPct",
      sortable: true,
      sortField: "wahfLatestAt",
      renderCell: (row) => (
        <ProgressCell
          mode="count"
          completed={row.wahfCompleted}
          required={row.wahfRequired}
          label="WAHF"
          unitLabel="form"
          isLate={row.wahfLate}
        />
      ),
    },
    {
      id: "mcf-progress",
      header: "MCF",
      width: "16%",
      field: "mcfPct",
      sortable: true,
      sortField: "mcfLatestAt",
      renderCell: (row) =>
        row.mcfRequired <= 0 ? (
          <div
            className="flex items-center gap-2 rounded px-2 py-1 text-xs bg-success-muted"
            title="MCF. No mentees assigned (required ≤ 0, including -1). Treated as complete."
          >
            <span>
              <span className="whitespace-pre-line font-semibold">0</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-xs">0 form</span>
            </span>
            <span className="text-xs font-bold text-black dark:text-white">100%</span>
          </div>
        ) : (
          <ProgressCell
            mode="count"
            completed={row.mcfCompleted}
            required={row.mcfRequired}
            label="MCF"
            unitLabel="form"
            isLate={row.mcfLate}
          />
        ),
    },
    {
      id: "wpl-progress",
      header: "WPL",
      width: "16%",
      field: "wplPct",
      sortable: true,
      sortField: "wplLatestAt",
      renderCell: (row) => (
        <ProgressCell
          mode="count"
          completed={row.wplCompleted}
          required={row.wplRequired}
          label="WPL"
          unitLabel="form"
          isLate={row.wplLate}
        />
      ),
    },
  ];

  return (
    <ScholarDataTable<TeamLeaderFormStatsRow>
      data={rows}
      rowKeyField="scholarId"
      defaultSortColumnId="name"
      defaultSortDirection="asc"
      rowDataAttributes={(row) => ({ "data-uid": row.scholarId })}
      nameColumn={{
        header: "Name",
        colSpan: 2,
        width: "36%",
        field: "name",
        fallbackField: "scholarId",
        sortField: "name",
        cellClassName: "font-medium",
        sortable: true,
      }}
      columns={columns}
      emptyMessage="No team leaders found."
    />
  );
}
