import { redirect } from "next/navigation";
import * as devContract from "@css-atlas/shared/contracts/dev";
import { callEndpoint } from "@/lib/server/api-client";
import { getCurrentUser } from "@/lib/server/queries";
import { isDeveloperProfile } from "@/lib/auth";
import { ProfileSwitcher } from "@/components/dev/profile-switcher";
import { DevActingBanner } from "@/components/dev/dev-acting-banner";

export const metadata = {
  title: "Dev Tools | CSS Atlas",
  description: "Developer-only tools for testing server functions",
};

/**
 * Developer-only layout. Protects all routes under /dev from non-developer users.
 * Redirects to /dashboard if the user doesn't have developer access.
 */
export default async function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await callEndpoint(devContract.ping).catch(() => null);
  if (!result) {
    redirect("/dashboard");
  }

  const me = await getCurrentUser();
  const isDeveloper = isDeveloperProfile(me?.realProfile ?? me?.profile ?? null);
  let testProfiles: readonly devContract.DevTestProfile[] = [];
  if (isDeveloper) {
    try {
      testProfiles = await callEndpoint(devContract.listTestProfiles);
    } catch {
      testProfiles = [];
    }
  }

  const actingLabel =
    typeof me?.profile?._devTestProfileLabel === "string"
      ? me.profile._devTestProfileLabel
      : "Test profile";

  return (
    <div className="space-y-4">
      {me?.isActingAsTestProfile && (
        <div className="container mx-auto max-w-4xl pt-4 px-4">
          <DevActingBanner label={actingLabel} />
        </div>
      )}
      {isDeveloper && testProfiles.length > 0 && (
        <div className="container mx-auto max-w-4xl px-4">
          <ProfileSwitcher
            testProfiles={testProfiles}
            activeTestProfileId={me?.activeTestProfileId ?? null}
          />
        </div>
      )}
      {children}
    </div>
  );
}
