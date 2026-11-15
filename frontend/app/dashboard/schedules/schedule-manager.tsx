"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { backendGet, backendPut } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleBoard, ScholarSchedule, ScheduleShiftInput } from "@/lib/types/schedules";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const selectClass = "rounded-md border bg-background px-3 py-2 text-sm";

/** The Monday of the week containing `dateKey`, computed in UTC so time zones cannot shift it. */
function mondayOf(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function ScheduleManager({ initialBoard }: { initialBoard: ScheduleBoard }) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [uid, setUid] = useState(initialBoard.scholars[0]?.uid ?? "");
  const [search, setSearch] = useState("");
  const selected = board.scholars.find((scholar) => scholar.uid === uid);
  const [draft, setDraft] = useState<ScheduleShiftInput[]>(selected?.shifts ?? []);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const semester = board.semester;
  const readOnly = !semester || board.weekStart < board.currentWeekStart;
  const filtered = board.scholars.filter((scholar) =>
    `${scholar.name} ${scholar.uid}`.toLowerCase().includes(search.toLowerCase()));

  function chooseScholar(nextUid: string) {
    setUid(nextUid);
    setDraft(board.scholars.find((scholar) => scholar.uid === nextUid)?.shifts ?? []);
    setDirty(false);
    setError("");
    setConflict(false);
    setMessage("");
  }

  function edit(index: number, update: Partial<ScheduleShiftInput>) {
    setDraft((rows) => rows.map((row, i) => i === index ? { ...row, ...update } : row));
    setDirty(true);
    setMessage("");
  }

  async function save() {
    if (saving.current || !selected || !semester || readOnly) return;
    saving.current = true;
    setPending(true);
    setError("");
    setConflict(false);
    setMessage("");
    try {
      const result = await backendPut<ScholarSchedule>(`/api/schedules/${encodeURIComponent(uid)}`, {
        semesterId: semester.id,
        effectiveWeekStart: board.weekStart,
        expectedRevision: selected.revision,
        shifts: draft.map(({ kind, dayOfWeek, startTime, endTime }) => ({ kind, dayOfWeek, startTime, endTime })),
      });
      if (!result.ok) {
        setError(result.error);
        setConflict(result.status === 409);
        return;
      }
      const scholar = result.data.scholar;
      setBoard((current) => ({ ...current, scholars: current.scholars.map((row) => row.uid === uid ? scholar : row) }));
      setDraft(scholar.shifts);
      setDirty(false);
      setMessage("Schedule saved. Earlier weeks are unchanged.");
    } catch {
      setError("Could not save the schedule. Your changes are still here.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  async function reload() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    try {
      const result = await backendGet<ScheduleBoard>(`/api/schedules?week=${encodeURIComponent(board.weekStart)}`);
      if (!result.ok) { setError(result.error); return; }
      const scholar = result.data.scholars.find((row) => row.uid === uid);
      setBoard(result.data);
      setDraft(scholar?.shifts ?? []);
      setDirty(false);
      setError("");
      setConflict(false);
      setMessage("Latest schedule loaded. The previous draft was discarded.");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <div><h1 className="text-2xl font-semibold">Scholar schedules</h1>
      <p className="mt-2 text-muted-foreground">Manage recurring front desk and study session shifts for any scholar.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="space-y-2">Search scholars<Input aria-label="Search scholars" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="flex flex-col gap-2">Scholar<select className={selectClass} aria-label="Scholar" value={uid} disabled={pending || dirty} onChange={(event) => chooseScholar(event.target.value)}>
        {selected && !filtered.some((scholar) => scholar.uid === uid) && <option value={uid}>{selected.name}</option>}
        {filtered.map((scholar) => <option key={scholar.uid} value={scholar.uid}>{scholar.name} ({scholar.uid})</option>)}
      </select></label>
      <label className="space-y-2">Week starting Monday<Input aria-label="Week starting Monday" type="date" value={board.weekStart} disabled={pending || dirty}
        onChange={(event) => { if (event.target.value) router.push(`/dashboard/schedules?week=${encodeURIComponent(mondayOf(event.target.value))}`); }} /></label>
    </div>
    {!semester && <p role="status">No active semester is configured.</p>}
    {readOnly && semester && <p role="status">Past weeks are read-only.</p>}
    {selected && semester && <section className="space-y-4" aria-label={`${selected.name}'s weekly schedule`}>
      <h2 className="text-xl font-semibold">{selected.name}</h2>
      <p>All times are Eastern. Saving replaces all planned weeks from {board.weekStart} through {semester.endDate}.
        {board.weekStart === board.currentWeekStart && " This includes earlier days in this week."} Previous weeks and recorded attendance logs do not change.</p>
      <fieldset disabled={pending || readOnly} className="space-y-3">
        <legend className="sr-only">Recurring shifts</legend>
        {draft.length === 0 && <p>No shifts scheduled. Saving an empty schedule removes shifts from this week forward.</p>}
        {draft.map((shift, index) => <div key={index} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-5">
          <label className="flex flex-col gap-2">Session<select className={selectClass} aria-label={`Session ${index + 1}`} value={shift.kind} onChange={(event) => {
            const kind = event.target.value;
            if (kind === "front_desk" || kind === "study_session") edit(index, { kind });
          }}><option value="front_desk">Front desk</option><option value="study_session">Study session</option></select></label>
          <label className="flex flex-col gap-2">Day<select className={selectClass} aria-label={`Day ${index + 1}`} value={shift.dayOfWeek} onChange={(event) => edit(index, { dayOfWeek: Number(event.target.value) })}>
            {DAYS.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}</select></label>
          <label className="space-y-2">Start<Input aria-label={`Start ${index + 1}`} type="time" value={shift.startTime} onChange={(event) => edit(index, { startTime: event.target.value })} /></label>
          <label className="space-y-2">End<Input aria-label={`End ${index + 1}`} type="time" value={shift.endTime} onChange={(event) => edit(index, { endTime: event.target.value })} /></label>
          <Button variant="outline" className="self-end" aria-label={`Remove shift ${index + 1}`} onClick={() => { setDraft((rows) => rows.filter((_, i) => i !== index)); setDirty(true); setMessage(""); }}>Remove</Button>
        </div>)}
        <Button variant="outline" onClick={() => { setDraft((rows) => [...rows, { kind: "front_desk", dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }]); setDirty(true); setMessage(""); }}>Add shift</Button>
      </fieldset>
      {dirty && <p>You have unsaved changes. Save or discard them before changing scholars or weeks.</p>}
      <div className="flex gap-3"><Button disabled={pending || readOnly || !dirty} onClick={save}>{pending ? "Saving…" : "Save schedule"}</Button>
        <Button variant="outline" disabled={pending || !dirty} onClick={() => { setDraft(selected.shifts); setDirty(false); setError(""); setConflict(false); }}>Discard changes</Button>
        {conflict && !pending && <Button variant="outline" onClick={reload}>Discard draft and reload latest</Button>}
      </div>
      {error && <p role="alert">{error} Your draft has not been discarded. Reloading may replace your draft.</p>}
      {message && <p role="status">{message}</p>}
    </section>}
    {board.scholars.length === 0 && <p>No scholars are available.</p>}
  </main>;
}
