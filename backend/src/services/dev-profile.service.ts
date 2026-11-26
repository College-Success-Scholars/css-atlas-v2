/**
 * @file dev-profile.service.ts
 * @module backend/services
 *
 * Developer test profile lookup and effective identity resolution.
 */
import { getSupabaseClient } from "../supabase/client.js";
import type { ProfilesRow } from "../models/user.model.js";
import {
  type DevTestProfileRow,
  DEV_ACTIVE_PROFILE_HEADER,
  isDeveloperProfile,
  isValidUuid,
  mapTestProfileToEffectiveRow,
} from "@css-atlas/shared/auth";

export type EffectiveProfileResult = {
  profile: ProfilesRow | null;
  realProfile: ProfilesRow | null;
  activeTestProfileId: string | null;
  isActingAsTestProfile: boolean;
};

export async function listTestProfiles(): Promise<DevTestProfileRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("dev_test_profiles")
    .select("*")
    .eq("is_active", true)
    .order("label");
  if (error) throw error;
  return (data ?? []) as DevTestProfileRow[];
}

export async function getTestProfileById(id: string): Promise<DevTestProfileRow | null> {
  if (!isValidUuid(id)) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("dev_test_profiles")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as DevTestProfileRow | null) ?? null;
}

function readActiveTestProfileId(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers[DEV_ACTIVE_PROFILE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !isValidUuid(value)) return null;
  return value;
}

export async function resolveEffectiveProfile(
  headers: Record<string, string | string[] | undefined>,
  realProfile: ProfilesRow | null,
): Promise<EffectiveProfileResult> {
  const base: EffectiveProfileResult = {
    profile: realProfile,
    realProfile,
    activeTestProfileId: null,
    isActingAsTestProfile: false,
  };

  if (!realProfile || !isDeveloperProfile(realProfile)) {
    return base;
  }

  const activeId = readActiveTestProfileId(headers);
  if (!activeId) {
    return base;
  }

  const testProfile = await getTestProfileById(activeId);
  if (!testProfile) {
    return base;
  }

  return {
    profile: mapTestProfileToEffectiveRow(realProfile, testProfile) as ProfilesRow,
    realProfile,
    activeTestProfileId: activeId,
    isActingAsTestProfile: true,
  };
}
