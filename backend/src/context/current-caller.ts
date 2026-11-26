/**
 * @file current-caller.ts
 * @module backend/context
 *
 * Who is making the current request, available to any Effect as a service.
 * http/endpoint.ts provides it for every request; tests provide it with
 * `Effect.provideService(CurrentCaller, caller)`.
 *
 * Read it with `const { actorId, asOf } = yield* CurrentCaller`. A function
 * that does so carries `CurrentCaller` in its type, so its dependence on the
 * request is visible without reading the body.
 */
import { Context } from "effect";
import type { ProfilesRow } from "../models/user.model.js";

export interface Caller {
  readonly userId: string;
  /** The signed-in user's auth email (Supabase Auth), which may differ from any profile email. */
  readonly email: string | null;
  /** Who to record as having made a change: the effective profile's Scholar ID, else the auth user id. */
  readonly actorId: string | null;
  /** Effective profile (a developer's test persona when acting as one). */
  readonly profile: ProfilesRow | null;
  /** The signed-in user's own profile; never a test persona. */
  readonly realProfile: ProfilesRow | null;
  /** The test persona a developer is acting as, or null. When set, `profile` is that persona. */
  readonly activeTestProfileId: string | null;
  readonly isActingAsTestProfile: boolean;
  /** The request time, read once at the edge. Services never read the clock. */
  readonly asOf: Date;
}

export class CurrentCaller extends Context.Service<CurrentCaller, Caller>()("CurrentCaller") {}
