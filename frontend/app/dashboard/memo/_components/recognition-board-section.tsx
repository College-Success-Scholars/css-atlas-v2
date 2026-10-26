import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MemoAccordionSection } from "./memo-accordion-section"
import { ScholarNameLink } from "./scholar-name-link"
import type { RecognitionBoardBand, RecognitionBoardBandId, RecognitionBoardSectionData } from "../types"

type RecognitionBoardSectionProps = {
  data: RecognitionBoardSectionData
}

const BAND_STYLE: Record<
  RecognitionBoardBandId,
  { badgeVariant: "success" | "warning" | "destructive"; gradeClassName: string }
> = {
  high: { badgeVariant: "success", gradeClassName: "text-success" },
  mid: { badgeVariant: "warning", gradeClassName: "text-warning-muted-foreground" },
  low: { badgeVariant: "destructive", gradeClassName: "text-destructive" },
}

function RecognitionBand({ band }: { band: RecognitionBoardBand }) {
  const style = BAND_STYLE[band.id]

  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{band.label}</div>
        <Badge variant={style.badgeVariant}>{band.entries.length}</Badge>
      </div>
      {band.entries.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">None</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {band.entries.map((entry, index) => (
            <li
              key={`${entry.scholarName}-${entry.course}-${entry.assessment}-${index}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">
                <span className="font-semibold">
                  <ScholarNameLink scholarId={entry.scholarId} isMentee={entry.isMentee} cohort={entry.cohort}>
                    {entry.scholarName}
                  </ScholarNameLink>
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {entry.course} · {entry.assessment}
                </span>
              </span>
              <span className={cn("shrink-0 font-semibold tabular-nums", style.gradeClassName)}>{entry.grade}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RecognitionBoardSection({ data }: RecognitionBoardSectionProps) {
  const total = data.bands.reduce((sum, band) => sum + band.entries.length, 0)

  return (
    <MemoAccordionSection
      title="Recognition board"
      description="Grades from this week's WAHF. Low grades also appear on scholar follow-up."
      badgeText={data.badgeText}
      rightLabel={data.rightLabel}
    >
      {total === 0 ? (
        <p className="text-muted-foreground px-4 py-4 text-sm">No assignment grades submitted this week.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-3 py-3 md:grid-cols-3">
          {data.bands.map((band) => (
            <RecognitionBand key={band.id} band={band} />
          ))}
        </div>
      )}
    </MemoAccordionSection>
  )
}
