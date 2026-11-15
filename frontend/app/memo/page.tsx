import { redirect } from "next/navigation";

/**
 * Legacy `/memo` URL — superseded by `/dashboard/memo`.
 */
export default function LegacyMemoRedirect() {
  redirect("/dashboard/memo");
}
