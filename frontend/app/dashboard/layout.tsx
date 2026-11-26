/**
 * @file layout.tsx
 * @module frontend/app/dashboard
 *
 * Dashboard section layout — provides the sidebar navigation shell for all
 * /dashboard/* routes. Renders AppSidebar, SidebarProvider, and a top breadcrumb.
 * Auth is enforced here or in the individual pages beneath this layout.
 *
 * ## What belongs here
 * - Shared dashboard chrome (sidebar, breadcrumb, header)
 *
 * ## What does NOT belong here
 * - Page-specific content or data fetching
 * - Route-specific auth logic (that goes in the individual pages)
 */
import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardHeader } from "@/components/layout/dashboard-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/queries";
import { listTestProfiles, type DevTestProfile } from "@css-atlas/shared/contracts/dev";
import { callEndpoint } from "@/lib/server/api-client";
import { isDeveloperProfile } from "@/lib/auth";
import { ProfilesRow } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check auth and profile via backend — redirects handled below
  const meResult = await getCurrentUser().catch(() => null);
  if (!meResult?.user?.id) {
    redirect("/auth/login");
  }

  if (!(meResult.realProfile ?? meResult.profile)) {
    redirect("/auth/complete-profile");
  }

  const profile = meResult.profile as ProfilesRow;
  const isDeveloper = isDeveloperProfile(meResult.realProfile ?? null);
  let testProfiles: readonly DevTestProfile[] = [];
  if (isDeveloper) {
    try {
      testProfiles = await callEndpoint(listTestProfiles);
    } catch {
      testProfiles = [];
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar
        profile={profile}
        realProfile={meResult.realProfile ?? null}
        isActingAsTestProfile={meResult.isActingAsTestProfile ?? false}
        activeTestProfileId={meResult.activeTestProfileId ?? null}
        testProfiles={testProfiles}
      />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
