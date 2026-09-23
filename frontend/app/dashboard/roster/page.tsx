import { permanentRedirect } from "next/navigation";

export default function RosterPage() {
  permanentRedirect("/dashboard/directory");
}
