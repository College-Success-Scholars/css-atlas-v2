/**
 * @file contracts/auth.ts
 * @module shared/contracts
 *
 * Contract for the identity half of /api/auth — the caller's own user and
 * profile, self-service onboarding, and the active semester. The mentee
 * endpoints under /api/auth/mentees are in contracts/mentees.ts.
 */
import { endpoint, Schema, wholeNumber } from "../contract.js";

/** A `profiles` row (or one merged with the roster): open-ended, because the backend selects `*`. */
export const profileRecord = Schema.Record(Schema.String, Schema.Unknown);
export type ProfileRecord = typeof profileRecord.Type;

export const currentUser = Schema.Struct({
  user: Schema.Struct({ id: Schema.String, email: Schema.NullOr(Schema.String) }),
  /** The effective profile: a developer's test persona while acting as one. */
  profile: Schema.NullOr(profileRecord),
  /** Developers only: the signed-in user's own profile, never a persona. */
  realProfile: Schema.optional(Schema.NullOr(profileRecord)),
  activeTestProfileId: Schema.optional(Schema.NullOr(Schema.String)),
  isActingAsTestProfile: Schema.optional(Schema.Boolean),
});
export type CurrentUser = typeof currentUser.Type;

/** The active `semesters` row. */
export const activeSemesterRow = Schema.Struct({
  id: Schema.Number,
  iso_week_offset: Schema.NullOr(Schema.Number),
  start_date: Schema.String,
  end_date: Schema.String,
});
export type ActiveSemesterRow = typeof activeSemesterRow.Type;

const requiredName = Schema.Trim.check(Schema.isMinLength(1, { message: "is required" }));

/** Self-service scholar onboarding. `student_id` and `cohort` may arrive as numeric strings. */
export const createProfileInput = Schema.Struct({
  first_name: requiredName,
  last_name: requiredName,
  student_id: wholeNumber(1, "must be a positive integer"),
  phone_number: Schema.optional(Schema.NullOr(Schema.String)),
  cohort: wholeNumber(1, "must be a positive integer"),
});
export type CreateProfileInput = typeof createProfileInput.Type;

/** The signed-in user, their effective profile, and (for developers) the real one and the persona in use. */
export const getMe = endpoint({
  method: "GET",
  path: "/api/auth/me",
  access: "authenticated",
  output: currentUser,
});

/** The caller's own `profiles` row. */
export const getProfile = endpoint({
  method: "GET",
  path: "/api/auth/profile",
  access: "authenticated",
  output: profileRecord,
});

/** Create the caller's own scholar profile. Needs a UMD email and no existing profile. */
export const createProfile = endpoint({
  method: "POST",
  path: "/api/auth/profile",
  access: "authenticated",
  status: 201,
  body: createProfileInput,
  output: profileRecord,
});

/**
 * The active semester row. Use sparingly: prefer the shared campus calendar
 * for week bounds, and this for historical data or the `semesters` row itself.
 */
export const getSemester = endpoint({
  method: "GET",
  path: "/api/auth/semester",
  access: "authenticated",
  output: activeSemesterRow,
});
