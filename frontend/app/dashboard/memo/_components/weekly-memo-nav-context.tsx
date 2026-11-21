"use client"

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"

export type WeeklyMemoNavState = {
  weekStartLabel: string | null
  weekEndLabel: string | null
  weekNumber: number | null
  availableWeeks: readonly number[]
  prevWeek: number | null
  nextWeek: number | null
  currentCampusWeek: number | null
  /** True after async content reports pre-Fall empty state (distinct from initial load). */
  yearNotStarted: boolean
  /** True once WeeklyMemoNavSync has run at least once. */
  hydrated: boolean
}

const defaultState: WeeklyMemoNavState = {
  weekStartLabel: null,
  weekEndLabel: null,
  weekNumber: null,
  availableWeeks: [],
  prevWeek: null,
  nextWeek: null,
  currentCampusWeek: null,
  yearNotStarted: false,
  hydrated: false,
}

const WeeklyMemoNavContext = createContext<WeeklyMemoNavState>(defaultState)
const WeeklyMemoNavSetterContext = createContext<Dispatch<SetStateAction<WeeklyMemoNavState>> | null>(null)

export function WeeklyMemoNavProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WeeklyMemoNavState>(defaultState)

  return (
    <WeeklyMemoNavSetterContext.Provider value={setState}>
      <WeeklyMemoNavContext.Provider value={state}>{children}</WeeklyMemoNavContext.Provider>
    </WeeklyMemoNavSetterContext.Provider>
  )
}

export function useWeeklyMemoNav() {
  return useContext(WeeklyMemoNavContext)
}

export type WeeklyMemoNavSyncProps = {
  weekStartLabel: string | null
  weekEndLabel: string | null
  weekNumber: number | null
  availableWeeks: readonly number[]
  prevWeek: number | null
  nextWeek: number | null
  currentCampusWeek: number | null
  yearNotStarted?: boolean
}

export function WeeklyMemoNavSync({
  weekStartLabel,
  weekEndLabel,
  weekNumber,
  availableWeeks,
  prevWeek,
  nextWeek,
  currentCampusWeek,
  yearNotStarted = false,
}: WeeklyMemoNavSyncProps) {
  const setState = useContext(WeeklyMemoNavSetterContext)

  useEffect(() => {
    setState?.({
      weekStartLabel,
      weekEndLabel,
      weekNumber,
      availableWeeks,
      prevWeek,
      nextWeek,
      currentCampusWeek,
      yearNotStarted,
      hydrated: true,
    })
  }, [
    weekStartLabel,
    weekEndLabel,
    weekNumber,
    availableWeeks,
    prevWeek,
    nextWeek,
    currentCampusWeek,
    yearNotStarted,
    setState,
  ])

  return null
}
