// components/roster/ScholarRosterTable.tsx
import type { RosterScholarRow } from "./type";

interface ScholarRosterProps {
  data: RosterScholarRow[];
}

export function ScholarRosterTable({ data }: ScholarRosterProps) {
  return (
    <div className="space-y-2">
      {data.map((row, index) => (
        // Renders clean flex-rows containing only scholar-visible data.
        // No stable id is sent to scholar-role requests, so index is the key.
        <div key={index} className="flex items-center justify-between gap-3 p-3 border-b">
          <div className="min-w-0">
            <p className="font-medium truncate">{row.scholarName}</p>
            <p className="text-xs text-gray-500 truncate">{row.email ?? "No email on file"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-right">
            <span className="text-sm text-gray-500">{row.programRole}</span>
            <span className="text-xs text-gray-400">{row.teams.length > 0 ? row.teams.join(", ") : "No team"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
