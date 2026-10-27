"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type HoursBenchmarkExportButtonProps = {
  available: boolean;
  filenameHint?: string;
  onExport?: () => Promise<void>;
};

export function hoursBenchmarkClientPdfFilename(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `hours-benchmark-${value("year")}-${value("month")}-${value("day")}-${value("hour")}${value("minute")}.pdf`;
}

export async function downloadHoursBenchmarkPdf() {
  const response = await fetch("/api/hours-benchmark/pdf");
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/pdf")) {
    throw new Error(`PDF generation failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ??
    hoursBenchmarkClientPdfFilename();
  link.click();
  URL.revokeObjectURL(url);
}

export function HoursBenchmarkExportButton({
  available,
  onExport = downloadHoursBenchmarkPdf,
}: HoursBenchmarkExportButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!available || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await onExport();
    } catch {
      setError("PDF generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (!available) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleExport} disabled={generating} aria-busy={generating}>
        {generating ? <LoaderCircle className="animate-spin" /> : <Download />}
        {generating ? "Generating PDF..." : "Export PDF"}
      </Button>
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
