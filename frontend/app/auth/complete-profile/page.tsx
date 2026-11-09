import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { getCurrentUser } from "@/lib/server/queries";
import { redirect } from "next/navigation";

export default async function CompleteProfilePage() {
  const me = await getCurrentUser().catch(() => null);

  if (!me?.user?.id) {
    redirect("/auth/login");
  }

  // Prefer realProfile (developers) so an existing account is not stuck on this
  // form when the effective overlay is empty.
  if (me.realProfile ?? me.profile) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <CompleteProfileForm />
      </div>
    </div>
  );
}
