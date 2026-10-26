import Link from "next/link"
import type { ReactNode } from "react"

import { directoryMenteePath } from "@/components/dashboard/widgets/directory-state"
import { cn } from "@/lib/utils"

type ScholarNameLinkProps = {
  scholarId?: string | null
  isMentee?: boolean
  /** Entry year carried into the detail page so tier cutoffs use the right class. */
  cohort?: number | null
  children: ReactNode
  className?: string
}

/**
 * Scholar name on the weekly memo. Mentees open the same detail page as the
 * directory; everyone else stays plain text because the memo has no profile modal.
 */
export function ScholarNameLink({
  scholarId,
  isMentee = false,
  cohort,
  children,
  className,
}: ScholarNameLinkProps) {
  const href = directoryMenteePath(scholarId ?? null, isMentee, cohort)

  if (!href) return <span className={className}>{children}</span>

  return (
    <Link
      href={href}
      className={cn(
        "rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </Link>
  )
}
