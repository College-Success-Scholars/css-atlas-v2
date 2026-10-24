import Link from "next/link"
import type { ReactNode } from "react"

import { directoryMenteePath } from "@/components/dashboard/widgets/directory-state"
import { cn } from "@/lib/utils"

type ScholarNameLinkProps = {
  scholarId?: string | null
  isMentee?: boolean
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
  children,
  className,
}: ScholarNameLinkProps) {
  const href = directoryMenteePath(scholarId ?? null, isMentee)

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
