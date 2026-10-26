"use client"

import { Crown, Gem, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { WeekTier } from "@/lib/types/mentee-review"
import styles from "./tier-styles.module.css"

interface TierUi {
  label: string
  Icon: LucideIcon | null
  /** Compact pill for the legend and requirement cards. */
  pill: string
  /** Tier ink for the "+N min extra" line. */
  text: string
  /** Progress-bar fill. */
  bar: string
  /** Whole-card treatment, including border, tint, glow, and motion. */
  card: string
  /** Grid-cell treatment, including its tier border. */
  cell: string
}

export const TIER_UI: Record<WeekTier, TierUi> = {
  rare: {
    label: "Rare",
    Icon: null,
    pill: cn(styles.palette, styles.rare, styles.pill),
    text: styles.text,
    bar: styles.bar,
    card: cn(styles.palette, styles.rare, styles.card),
    cell: cn(styles.palette, styles.rare, styles.cell),
  },
  epic: {
    label: "Epic",
    Icon: Gem,
    pill: cn(styles.palette, styles.epic, styles.pill),
    text: styles.text,
    bar: styles.bar,
    card: cn(styles.palette, styles.epic, styles.card),
    cell: cn(styles.palette, styles.epic, styles.cell),
  },
  legendary: {
    label: "Legendary",
    Icon: Crown,
    pill: cn(styles.palette, styles.legendary, styles.pill),
    text: styles.text,
    bar: styles.bar,
    card: cn(styles.palette, styles.legendary, styles.card, styles.sheen),
    cell: cn(styles.palette, styles.legendary, styles.cell, styles.sheen),
  },
}

export function TierBadge({
  tier,
  className,
}: {
  tier: WeekTier
  className?: string
}) {
  const { label, Icon, pill } = TIER_UI[tier]
  return (
    <span
      data-tier={tier}
      className={cn(
        "inline-flex h-[22px] w-[8em] shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.75 align-middle text-[12px] font-semibold leading-none whitespace-nowrap",
        pill,
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {label}
    </span>
  )
}
