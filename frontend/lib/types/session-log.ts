/** Frontend views of session logs. The wire types live in @css-atlas/shared/contracts/session-logs. */
import type {
  CleanedAndErroredScholar,
  ProcessedTicket,
  ScholarWithCompletedSession,
} from "@css-atlas/shared/contracts/session-logs";

export const SESSION_TYPE_STUDY = "Study Session";
export const SESSION_TYPE_FRONT_DESK = "Front Desk";
export type SessionType = typeof SESSION_TYPE_STUDY | typeof SESSION_TYPE_FRONT_DESK;

/** The cleaned/errored endpoints answer a record; callers work with this Map. */
export interface CleanedAndErroredResult {
  byScholarUid: Map<string, CleanedAndErroredScholar>;
  allCleaned: readonly ProcessedTicket[];
  allErrored: readonly ProcessedTicket[];
}

export interface DoubleEntry {
  scholarId: string;
  scholarName: string | null;
  studySession: ScholarWithCompletedSession;
  frontDeskSession: ScholarWithCompletedSession;
  overlapMs: number;
  overlapStart: string;
  overlapEnd: string;
}

export interface CleanedAndErroredOptions {
  treatUnclosedEntryAsError?: boolean;
  sessionType?: SessionType | string;
}

export interface ScholarsInRoomOptions {
  sessionType?: SessionType | string;
  asOf?: Date;
}

// ---------------------------------------------------------------------------
// Double entry detection (pure client-side function)
// ---------------------------------------------------------------------------

const MS_PER_MINUTE = 60 * 1000;

function computeOverlapMs(s1: number, e1: number, s2: number, e2: number) {
  const start = Math.max(s1, s2);
  const end = Math.min(e1, e2);
  return { overlapMs: Math.max(0, end - start), overlapStart: start, overlapEnd: end };
}

export function getDoubleEntries(
  completedStudy: readonly ScholarWithCompletedSession[],
  completedFrontDesk: readonly ScholarWithCompletedSession[],
  options: { toleranceMinutes?: number } = {}
): DoubleEntry[] {
  const toleranceMs = (options.toleranceMinutes ?? 5) * MS_PER_MINUTE;
  const studyByUid = new Map<string, ScholarWithCompletedSession[]>();
  for (const s of completedStudy) {
    const list = studyByUid.get(s.scholarId) ?? [];
    list.push(s);
    studyByUid.set(s.scholarId, list);
  }
  const fdByUid = new Map<string, ScholarWithCompletedSession[]>();
  for (const f of completedFrontDesk) {
    const list = fdByUid.get(f.scholarId) ?? [];
    list.push(f);
    fdByUid.set(f.scholarId, list);
  }
  const result: DoubleEntry[] = [];
  for (const uid of new Set([...studyByUid.keys(), ...fdByUid.keys()])) {
    const studySessions = studyByUid.get(uid) ?? [];
    const fdSessions = fdByUid.get(uid) ?? [];
    if (studySessions.length === 0 || fdSessions.length === 0) continue;
    const scholarName = studySessions[0]?.scholarName ?? fdSessions[0]?.scholarName ?? null;
    for (const study of studySessions) {
      for (const fd of fdSessions) {
        const { overlapMs: duration, overlapStart, overlapEnd } = computeOverlapMs(
          new Date(study.entryAt).getTime(), new Date(study.exitAt).getTime(),
          new Date(fd.entryAt).getTime(), new Date(fd.exitAt).getTime()
        );
        if (duration >= toleranceMs) {
          result.push({
            scholarId: uid, scholarName,
            studySession: study, frontDeskSession: fd,
            overlapMs: duration,
            overlapStart: new Date(overlapStart).toISOString(),
            overlapEnd: new Date(overlapEnd).toISOString(),
          });
        }
      }
    }
  }
  return result;
}
