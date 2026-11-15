"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDeveloperUser } from "@/lib/supabase/server";
import { DEV_ACTIVE_PROFILE_COOKIE } from "@css-atlas/shared/auth";
import { backendPost } from "./api-client";

/**
 * Sets or clears the active dev test profile cookie (developer only).
 * Validates profile id via backend when selecting a persona.
 */
export async function setActiveTestProfile(testProfileId: string | null): Promise<void> {
  const dev = await getDeveloperUser();
  if (!dev) {
    throw new Error("Developer access required");
  }

  if (testProfileId !== null) {
    await backendPost("/api/dev/active-profile", { testProfileId });
  }

  const store = await cookies();
  if (testProfileId) {
    store.set(DEV_ACTIVE_PROFILE_COOKIE, testProfileId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  } else {
    store.delete(DEV_ACTIVE_PROFILE_COOKIE);
  }

  revalidatePath("/", "layout");
}
