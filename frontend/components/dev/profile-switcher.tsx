"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setActiveTestProfile } from "@/lib/server/dev-profile-actions";
import type { DevTestProfile } from "@css-atlas/shared/contracts/dev";

const MY_PROFILE_VALUE = "__my_profile__";

type ProfileSwitcherProps = {
  testProfiles: readonly DevTestProfile[];
  activeTestProfileId: string | null;
  compact?: boolean;
};

export function ProfileSwitcher({
  testProfiles,
  activeTestProfileId,
  compact = false,
}: ProfileSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const value = activeTestProfileId ?? MY_PROFILE_VALUE;

  function onChange(next: string) {
    const id = next === MY_PROFILE_VALUE ? null : next;
    startTransition(async () => {
      await setActiveTestProfile(id);
      router.refresh();
    });
  }

  return (
    <div className={compact ? "w-full" : "space-y-1"}>
      {!compact && (
        <p className="text-muted-foreground text-xs font-medium px-1">Test profile</p>
      )}
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger className="w-full" size="sm">
          <SelectValue placeholder="My profile" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={MY_PROFILE_VALUE}>My profile</SelectItem>
          {testProfiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
