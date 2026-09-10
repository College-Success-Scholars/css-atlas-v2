import { getCurrentUser } from "@/lib/server/queries"
import { resolveUserRole } from "@/lib/auth"
import DirectoryPage from "./DirectoryPage"
import { fetchDirectoryRoster } from "./roster-data"

export default async function Page() {
  const me = await getCurrentUser()

  const resolvedRole = resolveUserRole(me?.profile)

  const viewerRole =
    resolvedRole === "default" ? "scholar" : resolvedRole

  const rows =
    viewerRole === "scholar"
      ? await fetchDirectoryRoster("scholar")
      : await fetchDirectoryRoster(viewerRole)

  return <DirectoryPage viewerRole={viewerRole} initialRows={rows} />
}
