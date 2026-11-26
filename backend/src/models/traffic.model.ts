/**
 * @file traffic.model.ts
 * @module backend/models
 *
 * TypeScript types for traffic entry data.
 * Traffic entries represent front-desk check-in/out events counted per campus week.
 *
 * ## What belongs here
 * - Row types for the traffic/session log tables as used for entry counting
 * - TrafficSession (paired check-in/out), WeekEntryCount (aggregate per week)
 *
 * ## What does NOT belong here
 * - Functions, queries, or runtime logic
 */

export interface TrafficRow {
  id: number;
  created_at: string;
  uid: string | null;
  traffic_type: string | null;
}

export type { TrafficSession, WeekEntryCount } from "@css-atlas/shared/contracts/traffic";
