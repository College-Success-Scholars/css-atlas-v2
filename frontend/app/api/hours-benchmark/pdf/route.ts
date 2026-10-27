/**
 * Same-origin proxy for GET /api/hours-benchmark/pdf.
 *
 * The Export PDF button must not call Express from the browser: production
 * Docker often bakes an empty NEXT_PUBLIC_BACKEND_URL, which falls back to
 * localhost and fails while server components (BACKEND_URL) still load.
 */
import { getHoursBenchmarkPdf } from "@/lib/server/data";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const upstream = await getHoursBenchmarkPdf();
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
