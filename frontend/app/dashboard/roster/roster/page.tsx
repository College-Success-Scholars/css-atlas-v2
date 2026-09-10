import { getCurrentUser } from "@/lib/server/queries"
import { resolveUserRole } from "@/lib/auth"
import DirectoryPage from "./DirectoryPage"

export default async function Page() {
  const me = await getCurrentUser()

  const resolvedRole = resolveUserRole(me?.profile)

  const viewerRole =
    resolvedRole === "default" ? "scholar" : resolvedRole

  return <DirectoryPage viewerRole={viewerRole} />
}