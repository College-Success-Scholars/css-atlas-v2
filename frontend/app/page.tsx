/**
 * @file page.tsx
 * @module frontend/app
 *
 * Root landing page (/).
 * Shows the marketing hero to unauthenticated visitors.
 * Redirects authenticated users directly to /dashboard.
 *
 * ## What belongs here
 * - Public landing page rendering
 * - Auth redirect for already-logged-in users
 *
 * ## What does NOT belong here
 * - Authenticated-only content
 * - Auth forms (those are in app/auth/)
 */
import { redirect } from "next/navigation";
import { getMe } from "@css-atlas/shared/contracts/auth";
import { callEndpoint } from "@/lib/server/api-client";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingFeatureCards } from "@/components/marketing/landing-feature-cards";

export default async function Home() {
  const user = await callEndpoint(getMe).catch(() => null);

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 sm:py-10 md:px-5 md:py-8">

        <LandingHero />
        <LandingFeatureCards />
      </div>
    </div>
  );
}
