import { TrendingUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { WeeklyKpiCard } from "../types"

type WeeklyKpiCardsProps = {
  cards: WeeklyKpiCard[]
}

/** Domain tokens from globals.css / cssColor: FD orange (`--front-desk`), SS blue (`--study`). */
const KPI_TRACK_COLOR: Record<string, string> = {
  "Front desk hours": "bg-front-desk/20 [&_[data-slot=progress-indicator]]:bg-front-desk",
  "Study session hours": "bg-study/20 [&_[data-slot=progress-indicator]]:bg-study",
}

function KpiTrack({ label, pct, colorClass }: { label: string; pct: number; colorClass?: string }) {
  return (
    <Progress
      value={pct}
      className={cn("h-2.5 bg-muted", colorClass)}
      aria-label={label}
    />
  )
}

export function WeeklyKpiCards({ cards }: WeeklyKpiCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const trackColor = KPI_TRACK_COLOR[card.title]
        return (
          <Card key={card.title} className="gap-0 bg-muted/20 py-0">
            <CardHeader className="gap-1 px-4 pt-4 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              <div className="text-3xl font-semibold tabular-nums">{card.primaryValue}</div>
              <p className="text-muted-foreground text-xs">{card.secondaryText}</p>
              {card.pct != null && (
                <KpiTrack
                  label={`${card.title} ${card.primaryValue}`}
                  pct={card.pct}
                  colorClass={trackColor}
                />
              )}
              {card.trendText && (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <TrendingUp className="size-3" />
                  <span>{card.trendText}</span>
                </div>
              )}
              {card.subStats.length > 0 && (
                <div className="space-y-2 pt-1">
                  {card.subStats.map((stat) => (
                    <div key={stat.label} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-muted-foreground text-xs">{stat.label}</div>
                        <div className="text-sm font-semibold tabular-nums">{stat.value}</div>
                      </div>
                      {stat.pct != null && (
                        <KpiTrack
                          label={`${stat.label} ${stat.value}`}
                          pct={stat.pct}
                          colorClass={trackColor}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
