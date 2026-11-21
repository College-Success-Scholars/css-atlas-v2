/**
 * @file dev.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/dev, bound to the contract in
 * @css-atlas/shared/contracts/dev. Developer-only diagnostics and tools:
 * test-profile switching, roster editing, the freshman and sophomore grades
 * report, and the FD/SS schedule board.
 */
import { Effect } from "effect";
import * as contract from "@css-atlas/shared/contracts/dev";
import { isDeveloperProfile } from "@css-atlas/shared/auth";
import { implement } from "../http/endpoint.js";
import { getTestProfileById, listTestProfiles } from "../services/dev-profile.service.js";
import { getFreshmanGradesReport } from "../services/freshman-grades.service.js";
import { getScheduleBoard, replaceScholarStandingShifts } from "../services/schedule-board.service.js";
import { getRosterByUid, updateRosterByUid } from "../services/user.service.js";
import { NotFoundError, ValidationError } from "../utils/domain-error.js";

export const devEndpoints = [
  implement(contract.ping, (_input, caller) =>
    Effect.succeed({
      ok: true,
      message: "Developer API test successful",
      user: caller.email,
      timestamp: caller.asOf.toISOString(),
    }),
  ),

  implement(contract.me, (_input, caller) =>
    Effect.succeed({
      user: { id: caller.userId, email: caller.email },
      profile: caller.realProfile
        ? { app_role: caller.realProfile.app_role ?? null, email: caller.realProfile.emails?.[0] ?? null }
        : null,
      activeTestProfileId: caller.activeTestProfileId,
      isActingAsTestProfile: caller.isActingAsTestProfile,
    }),
  ),

  implement(contract.listTestProfiles, () => listTestProfiles()),

  implement(contract.setActiveProfile, async ({ body }, caller) => {
    const testProfileId = body.testProfileId ?? null;
    if (testProfileId !== null && !(await getTestProfileById(testProfileId))) {
      throw new NotFoundError({ resource: "Test profile" });
    }
    return {
      user: { id: caller.userId, email: caller.email },
      profile: caller.profile,
      realProfile: caller.realProfile,
      activeTestProfileId: testProfileId,
      isActingAsTestProfile: testProfileId !== null,
      isDeveloper: isDeveloperProfile(caller.realProfile),
    };
  }),

  implement(contract.getFreshmanGrades, () => getFreshmanGradesReport()),

  implement(contract.getScheduleBoard, () => getScheduleBoard()),

  implement(contract.replaceShifts, ({ params, body }) => replaceScholarStandingShifts(params.uid, body.shifts)),

  implement(contract.getRoster, async ({ params }) => {
    const roster = await getRosterByUid(params.uid);
    if (!roster) throw new NotFoundError({ resource: "User" });
    return roster;
  }),

  implement(contract.patchRoster, ({ params, body }) => {
    if (Object.keys(body).length === 0) {
      throw new ValidationError({ field: "", message: "No roster fields to update" });
    }
    return updateRosterByUid(params.uid, body);
  }),
];
