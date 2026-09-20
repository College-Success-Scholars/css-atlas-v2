import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Card, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"

type RosterAccordionSectionProps = {
    title: string
    description?: string
    badgeText?: ReactNode
    badgeClassName?: string
    badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
    rightLabel?: string
    defaultOpen?: boolean
    children: ReactNode
}

export function RosterAccordionSection({
    title,
    description,
    badgeText,
    badgeClassName,
    badgeVariant,
    rightLabel,
    defaultOpen = false,
    children,
}: RosterAccordionSectionProps) {
  return (
    <Card className="gap-0 py-0">
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="group w-full cursor-pointer px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
                {badgeText ? (
                  typeof badgeText === "string" ? (
                    <Badge variant={badgeVariant} className={badgeClassName}>
                      {badgeText}
                    </Badge>
                  ) : (
                    badgeText
                  )
                ) : null}
              </div>
              {description ? (
                <p className="text-muted-foreground mt-1 text-xs leading-snug">{description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {rightLabel ? <span className="text-muted-foreground text-xs">{rightLabel}</span> : null}
              <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className={cn("overflow-hidden border-t data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down")}>
          {children}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
