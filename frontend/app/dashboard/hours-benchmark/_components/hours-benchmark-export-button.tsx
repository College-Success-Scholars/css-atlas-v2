"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { HoursBenchmarkHeatmapScope } from "../types";

type HoursBenchmarkExportButtonProps = {
  available: boolean;
  scope: HoursBenchmarkHeatmapScope;
  label: string;
  onExport?: (scope: HoursBenchmarkHeatmapScope) => Promise<void>;
};

export function hoursBenchmarkClientPdfFilename(
  now = new Date(),
  scope: HoursBenchmarkHeatmapScope = "low",
) {
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
  const scopeSuffix = scope === "all" ? "-all" : "";
  return `hours-benchmark${scopeSuffix}-${value("year")}-${value("month")}-${value("day")}-${value("hour")}${value("minute")}.pdf`;
}

export async function downloadHoursBenchmarkPdf(scope: HoursBenchmarkHeatmapScope = "low") {
  const response = await fetch(`/api/hours-benchmark/pdf?scope=${scope}`);
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
    hoursBenchmarkClientPdfFilename(new Date(), scope);
  link.click();
  URL.revokeObjectURL(url);
}

export function HoursBenchmarkExportButton({
  available,
  scope,
  label,
  onExport = downloadHoursBenchmarkPdf,
}: HoursBenchmarkExportButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!available || generating) return;
    setGenerating(true);
    setError(null);
    try {
      await onExport(scope);
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
        {generating ? "Generating PDF..." : label}
      </Button>
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
