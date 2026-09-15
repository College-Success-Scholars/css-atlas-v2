// components/roster/TeamLeaderRosterTable.tsx
import type { RosterTLRow } from "./type";
import { Badge } from "@/components/ui/badge";

interface TeamLeaderRosterProps {
  data: RosterTLRow[];
}

export function TeamLeaderRosterTable({ data }: TeamLeaderRosterProps) {
  // Prevent crash if data is null, undefined, or empty
  if (!data || data.length === 0) return null; 

  return (
    <div className="space-y-2">
      {data.map((row, index) => {
        // Fallback to loop index if backend unique id is missing unexpectedly
        const rowKey = row?.uid ?? `tl-row-${index}`; 
        
        if (!row) return null; // Safeguard against empty array elements

        return (
          <div key={rowKey} className="flex justify-between items-center p-3 border-b">
            <div>
              <p className="font-bold">{row.scholarName} ({row.cohort ?? "N/A"})</p>
              <p className="text-xs text-gray-400">{row.email} | {row.phone ?? "No Phone"}</p>
              <p className="text-[11px] text-gray-400">UID: {row.uid}</p>
              
            </div>

            <div className="flex shrink-0 items-center gap-3 text-right">
              <span className="text-sm text-gray-500">{row.programRole}</span>
              <Badge variant="secondary">{row.appRole ?? "—"}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
