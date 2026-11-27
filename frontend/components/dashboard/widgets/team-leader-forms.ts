import { mcfProgressLabel, type FormStatusResult } from "@/components/personal/utils";

/** How one form reads for one week in the team leader popup's semester grid. */
export type FormCellTone = "on-time" | "late" | "partial" | "missing" | "not-due" | "none";

export type FormCell = {
  tone: FormCellTone;
  /** Short status for tabs and screen readers, e.g. "On time". */
  label: string;
  /** MCF coverage such as "1/2"; null for WAHF and WPL, which show an icon. */
  coverage: string | null;
  /** `coverage` spelled out for screen readers, e.g. "1 of 2 mentees". */
  coverageLabel: string | null;
};

const TONE_LABELS: Record<FormCellTone, string> = {
  "on-time": "On time",
  late: "Late",
  partial: "Partial",
  missing: "Missing",
  "not-due": "Not yet due",
  none: "No mentees",
};

function toneFor({ status, isLate }: FormStatusResult): FormCellTone {
  if (status === "pending") return "not-due";
  if (status === "done") return isLate ? "late" : "on-time";
  return status === "incomplete" ? "partial" : "missing";
}

function cell(tone: FormCellTone, coverage: string | null = null, coverageLabel: string | null = null): FormCell {
  return { tone, label: TONE_LABELS[tone], coverage, coverageLabel };
}

/**
 * Reads a cell from the same getFormStatusForWeek result the TL's Personal page
 * shows, so the grid and Personal never disagree about a week.
 */
export function formCellFor(status: FormStatusResult): FormCell {
  if (status.formType !== "MCF") return cell(toneFor(status));
  const { completedCount, requiredCount } = status;
  if (requiredCount <= 0) return cell("none", "—");
  return cell(toneFor(status), `${completedCount}/${requiredCount}`, mcfProgressLabel(completedCount, requiredCount));
}

/** Cell fill per tone, from theme tokens so light and dark both read. */
export const FORM_CELL_TONE_CLASSES: Record<FormCellTone, string> = {
  "on-time": "border-success/40 bg-success-muted text-success-muted-foreground",
  late: "border-warning/60 bg-warning-muted text-warning-muted-foreground",
  partial: "border-warning/60 bg-warning-muted text-warning-muted-foreground",
  missing: "border-destructive/40 bg-destructive/10 text-destructive",
  "not-due": "border-dashed border-info/70 bg-transparent text-info",
  none: "border-border bg-muted/40 text-muted-foreground",
};

export const FORM_CELL_DOT_CLASSES: Record<FormCellTone, string> = {
  "on-time": "bg-success",
  late: "bg-warning",
  partial: "bg-warning",
  missing: "bg-destructive",
  "not-due": "bg-info",
  none: "bg-muted-foreground",
};
