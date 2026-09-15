"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { backendPatch } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  freshmanCohortYear,
  isHourEligibleCohort,
  sophomoreCohortYear,
} from "@/lib/format/time";
import type { RosterRow } from "@/lib/types/roster";

const STATUS_OPTIONS = ["enrolled", "inactive", "graduated"] as const;
const PROGRAM_ROLE_OPTIONS = [
  "Scholar",
  "Team Leader",
  "GA",
  "Admin",
  "Program Coordinator",
] as const;

function csv(values: string[] | null): string {
  return (values ?? []).join(", ");
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type RosterEditFormProps = {
  roster: RosterRow;
};

export function RosterEditForm({ roster }: RosterEditFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(roster.first_name ?? "");
  const [lastName, setLastName] = useState(roster.last_name ?? "");
  const [phone, setPhone] = useState(roster.phone_number ?? "");
  const [email, setEmail] = useState(roster.email ?? "");
  const [cohort, setCohort] = useState(roster.cohort != null ? String(roster.cohort) : "");
  const [status, setStatus] = useState((roster.status ?? "enrolled").toLowerCase());
  const [programRole, setProgramRole] = useState(roster.program_role ?? "Scholar");
  const [fdRequired, setFdRequired] = useState(
    roster.fd_required != null ? String(roster.fd_required) : "",
  );
  const [ssRequired, setSsRequired] = useState(
    roster.ss_required != null ? String(roster.ss_required) : "",
  );
  const [majors, setMajors] = useState(csv(roster.majors));
  const [minors, setMinors] = useState(csv(roster.minors));
  const [teams, setTeams] = useState(csv(roster.teams));
  const [menteeUids, setMenteeUids] = useState(csv(roster.mentee_uids));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cohortNum = cohort.trim() === "" ? null : Number.parseInt(cohort.trim(), 10);
  const hoursApply = isHourEligibleCohort(Number.isFinite(cohortNum) ? cohortNum : null);
  const freshmanYear = freshmanCohortYear();
  const sophomoreYear = sophomoreCohortYear();

  const statusOptions = useMemo(() => {
    const extra = STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])
      ? []
      : status
        ? [status]
        : [];
    return [...STATUS_OPTIONS, ...extra];
  }, [status]);

  const programRoleOptions = useMemo(() => {
    if (PROGRAM_ROLE_OPTIONS.includes(programRole as (typeof PROGRAM_ROLE_OPTIONS)[number])) {
      return PROGRAM_ROLE_OPTIONS;
    }
    return programRole ? [programRole, ...PROGRAM_ROLE_OPTIONS] : PROGRAM_ROLE_OPTIONS;
  }, [programRole]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await backendPatch<RosterRow>(
      `/api/dev/roster/${encodeURIComponent(roster.uid)}`,
      {
        first_name: optionalText(firstName),
        last_name: optionalText(lastName),
        phone_number: optionalText(phone),
        email: optionalText(email),
        cohort: cohort.trim() === "" ? null : Number.parseInt(cohort.trim(), 10),
        status,
        program_role: optionalText(programRole),
        fd_required: fdRequired.trim() === "" ? null : Number.parseInt(fdRequired.trim(), 10),
        ss_required: ssRequired.trim() === "" ? null : Number.parseInt(ssRequired.trim(), 10),
        majors: parseCsv(majors),
        minors: parseCsv(minors),
        teams: parseCsv(teams),
        mentee_uids: parseCsv(menteeUids),
      },
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Writes <code>user_roster</code> and the matching <code>profiles</code> row. Inactive
        and graduated scholars and team leaders drop off Memo immediately. Hours only count for freshman (
        {freshmanYear}) and sophomore ({sophomoreYear}) cohorts. <code>app_role</code> is read-only
        in the app.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Last name">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Cohort">
          <Input
            inputMode="numeric"
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
          />
        </Field>
        <Field label="Enrollment status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Program role">
          <Select value={programRole} onValueChange={setProgramRole}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Program role" />
            </SelectTrigger>
            <SelectContent>
              {programRoleOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="FD required (minutes)">
          <Input
            inputMode="numeric"
            value={fdRequired}
            onChange={(e) => setFdRequired(e.target.value)}
            disabled={!hoursApply}
          />
        </Field>
        <Field label="SS required (minutes)">
          <Input
            inputMode="numeric"
            value={ssRequired}
            onChange={(e) => setSsRequired(e.target.value)}
            disabled={!hoursApply}
          />
        </Field>
      </div>

      {!hoursApply && (
        <p className="text-muted-foreground text-sm">
          Front desk and study session hours do not count for this cohort. Leftover values are
          shown but will not appear on Memo or attendance boards.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4">
        <Field label="Majors (comma-separated)">
          <Input value={majors} onChange={(e) => setMajors(e.target.value)} />
        </Field>
        <Field label="Minors (comma-separated)">
          <Input value={minors} onChange={(e) => setMinors(e.target.value)} />
        </Field>
        <Field label="Teams (comma-separated)">
          <Input value={teams} onChange={(e) => setTeams(e.target.value)} />
        </Field>
        <Field label="Mentee UIDs (comma-separated)">
          <Input value={menteeUids} onChange={(e) => setMenteeUids(e.target.value)} />
        </Field>
      </div>

      <dl className="text-muted-foreground grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        <div>UID: <span className="font-mono">{roster.uid}</span></div>
        <div>App role: {roster.app_role ?? "—"} (not editable)</div>
        <div>Created: {roster.created_at}</div>
        <div>Invite sent: {roster.invite_sent_at ?? "—"}</div>
        <div>Invite accepted: {roster.invite_accepted_at ?? "—"}</div>
      </dl>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save roster"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
