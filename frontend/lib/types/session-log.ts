/** Types mirroring backend/src/models/session-log.model.ts */

export const SESSION_TYPE_STUDY = "Study Session";
export const SESSION_TYPE_FRONT_DESK = "Front Desk";
export type SessionType = typeof SESSION_TYPE_STUDY | typeof SESSION_TYPE_FRONT_DESK;

export interface SessionLogRow {
  id: string;
  created_at: string;
  scholar_uid: string | null;
  scholar_name?: string | null;
  action_type: string | null;
  session_type?: string | null;
  [key: string]: unknown;
}

export interface SessionLogConfig {
  entryAction: string;
  exitAction: string;
}

export type TicketErrorType =
  | "DOUBLE_EXIT"
  | "DOUBLE_ENTER"
  | "EXIT_BEFORE_ENTER"
  | "EXIT_WITHOUT_ENTER"
  | "ENTRY_WITHOUT_SAME_DAY_EXIT";

export interface ProcessedTicket {
  ticket: SessionLogRow;
  error?: TicketErrorType;
  pairedEntryAt?: string;
}

export interface CleanedAndErroredResult {
  byScholarUid: Map<
    string,
    { cleaned: ProcessedTicket[]; errored: ProcessedTicket[]; scholarName: string | null }
  >;
  allCleaned: ProcessedTicket[];
  allErrored: ProcessedTicket[];
}

export interface ScholarInRoom {
  scholarId: string;
  scholarName: string | null;
  entryTicket: SessionLogRow;
  entryAt: string;
  timeInRoomMs: number;
  sessionType?: string | null;
}

export interface ScholarWithCompletedSession {
  scholarId: string;
  scholarName: string | null;
  entryTicket: SessionLogRow;
  exitTicket: SessionLogRow;
  entryAt: string;
  exitAt: string;
  durationMs: number;
  sessionType?: string | null;
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
  completedStudy: ScholarWithCompletedSession[],
  completedFrontDesk: ScholarWithCompletedSession[],
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

export interface ScholarNoShow {
  scholarId: string;
  scholarName: string;
  phoneNumber: string | null;
}

/** Compatibility alias for existing Study Session callers. */
export type StudySessionNoShow = ScholarNoShow;
