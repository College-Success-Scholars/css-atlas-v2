/**
 * Same-origin proxy for GET /api/memo/pdf.
 *
 * The Export PDF button must not call Express from the browser: production
 * Docker often bakes an empty NEXT_PUBLIC_BACKEND_URL, which falls back to
 * localhost and fails while the memo page (BACKEND_URL) still loads.
 */
import { getWeeklyMemoPdf } from "@/lib/server/data";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const weekNumber = Number.parseInt(request.nextUrl.searchParams.get("weekNumber") ?? "", 10);
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "weekNumber must be a number >= 1" }, { status: 400 });
  }

  try {
    const upstream = await getWeeklyMemoPdf(weekNumber);
    const headers = new Headers();
    const contentType = upstream.headers.get("Content-Type");
    const contentDisposition = upstream.headers.get("Content-Disposition");
    if (contentType) headers.set("Content-Type", contentType);
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
    headers.set("Cache-Control", "no-store, max-age=0");
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ error: "PDF generation failed. Please try again." }, { status: 503 });
  }
}
