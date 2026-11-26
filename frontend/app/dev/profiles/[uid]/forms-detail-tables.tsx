"use client";

import { useState } from "react";
import { dateToCampusWeek, formatDate } from "@/lib/format/time";
import type { McfFormLogRow, WplFormLogRow } from "@css-atlas/shared/contracts/form-logs";
import { callEndpoint } from "@/lib/client/api-client";
import { getById } from "@css-atlas/shared/contracts/form-logs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatDetailValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type DetailState = {
  open: boolean;
  title: string;
  description: string;
  fields: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
};

type Props = {
  mcfRows: readonly McfFormLogRow[];
  wplRows: readonly WplFormLogRow[];
};

export function FormsDetailTables({ mcfRows, wplRows }: Props) {
  const [detail, setDetail] = useState<DetailState>({
    open: false,
    title: "",
    description: "",
    fields: null,
    loading: false,
    error: null,
  });

  async function openDetail(formType: "mcf" | "wpl", formId: string | number) {
    setDetail((prev) => ({
      ...prev,
      open: true,
      loading: true,
      error: null,
      fields: null,
      title: `${formType.toUpperCase()} submission`,
      description: `Loading details for ${formType.toUpperCase()} form ${formId}...`,
    }));

    try {
      const result = await callEndpoint(getById, { params: { form_type: formType, id: String(formId) } });
      if (!result.ok) {
        throw new Error(result.error);
      }
      const fields = result.data ?? null;
      setDetail({
        open: true,
        loading: false,
        error: fields ? null : "No details found for this submission.",
        fields,
        title: `${formType.toUpperCase()} submission`,
        description: `Form ID: ${formId}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setDetail({
        open: true,
        loading: false,
        error: `Could not load form details: ${message}`,
        fields: null,
        title: `${formType.toUpperCase()} submission`,
        description: `Form ID: ${formId}`,
      });
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCF submissions</CardTitle>
          <CardDescription>Mentor Check-in Form (mentor or mentee)</CardDescription>
        </CardHeader>
        <CardContent>
          {mcfRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No MCF submissions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Week #</TableHead>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Mentee</TableHead>
                  <TableHead>Meeting date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mcfRows.map((row) => {
                  const campusWeek = dateToCampusWeek(new Date(row.created_at));
                  return (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open MCF submission ${row.id} details`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail("mcf", row.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail("mcf", row.id);
                        }
                      }}
                    >
                      <TableCell className="text-sm">{formatDate(row.created_at)}</TableCell>
                      <TableCell>{campusWeek ?? "—"}</TableCell>
                      <TableCell>{row.mentor_name ?? row.mentor_uid ?? "—"}</TableCell>
                      <TableCell>{row.mentee_name ?? row.mentee_uid ?? "—"}</TableCell>
                      <TableCell>{row.meeting_date ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WPL submissions</CardTitle>
          <CardDescription>Work Placement Log</CardDescription>
        </CardHeader>
        <CardContent>
          {wplRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No WPL submissions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Week #</TableHead>
                  <TableHead>Scholar</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Full name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wplRows.map((row) => {
                  const campusWeek = row.created_at
                    ? dateToCampusWeek(new Date(row.created_at))
                    : null;
                  return (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open WPL submission ${row.id} details`}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail("wpl", row.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail("wpl", row.id);
                        }
                      }}
                    >
                      <TableCell className="text-sm">
                        {row.created_at ? formatDate(row.created_at) : "—"}
                      </TableCell>
                      <TableCell>{campusWeek ?? "—"}</TableCell>
                      <TableCell>{row.scholar_uid ?? "—"}</TableCell>
                      <TableCell>{row.hours_worked ?? "—"}</TableCell>
                      <TableCell>{row.full_name ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detail.open}
        onOpenChange={(open) =>
          setDetail((prev) =>
            open
              ? prev
              : {
                  ...prev,
                  open: false,
                  loading: false,
                  error: null,
                  fields: null,
                },
          )
        }
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail.title}</DialogTitle>
            <DialogDescription>{detail.description}</DialogDescription>
          </DialogHeader>
          {detail.loading && (
            <p className="text-muted-foreground text-sm">Loading form details...</p>
          )}
          {detail.error && <p className="text-destructive text-sm">{detail.error}</p>}
          {!detail.loading && !detail.error && detail.fields && (
            <div className="space-y-3">
              {Object.entries(detail.fields).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[180px_1fr] gap-3 border-b pb-2">
                  <p className="text-muted-foreground text-sm font-medium">{key}</p>
                  <pre className="whitespace-pre-wrap wrap-break-word text-sm">
                    {formatDetailValue(value)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
