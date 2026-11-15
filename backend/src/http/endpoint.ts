/**
 * @file endpoint.ts
 * @module backend/http
 *
 * Request handling for contract-backed endpoints. `implement` binds a handler
 * to a contract from @css-atlas/shared/contracts/*; this module then owns the
 * whole request lifecycle:
 *
 *   authenticate + role check (from contract.access)
 *   → validate params, query, body (400 on failure)
 *   → handler(input, caller)
 *   → validate the result against contract.output
 *   → { data } envelope
 *
 * Any thrown error goes to the global error handler in app.ts. A handler is
 * a function from valid input to data and contains none of the above.
 *
 * ## What belongs here
 * - The request lifecycle shared by every endpoint
 *
 * ## What does NOT belong here
 * - Anything specific to one endpoint or domain
 */
import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { validate, type Access, type Endpoint, type EndpointInput, type EndpointResult } from "@css-atlas/shared/contract";
import {
  requireAuth,
  requireDeveloper,
  requireTeamLeaderOrAbove,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import type { ProfilesRow } from "../models/user.model.js";
import { invalid } from "../utils/app-error.js";

/** Who is making the request. */
export interface Caller {
  userId: string;
  /** Effective profile (a developer's test persona when acting as one). */
  profile: ProfilesRow | null;
  /** The signed-in user's own profile; never a test persona. */
  realProfile: ProfilesRow | null;
  /** The clock, read once at the edge. Pass it down; services never read the time. */
  asOf: Date;
}

/** A handler returns what the contract's output schema accepts. */
export type Handler<E extends Endpoint> = (
  input: EndpointInput<E>,
  caller: Caller,
) => Promise<EndpointResult<E>>;

/** A contract bound to its handler, ready to mount. */
export interface BoundEndpoint {
  readonly contract: Endpoint;
  readonly handle: RequestHandler;
}

const AUTH: Record<Access, RequestHandler> = {
  authenticated: requireAuth as RequestHandler,
  team_leader: requireTeamLeaderOrAbove as RequestHandler,
  developer: requireDeveloper as RequestHandler,
};

function parsePart<T>(schema: Parameters<typeof validate>[0], part: string, value: unknown): T {
  const result = validate(schema, value ?? {});
  if (result.ok) return result.data as T;
  throw invalid(`${result.field || part} ${result.message}`);
}

/** Bind a handler to its contract. */
export function implement<E extends Endpoint>(contract: E, handler: Handler<E>): BoundEndpoint {
  const handle = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve()
      .then(async () => {
        const input: EndpointInput<E> = {
          params: parsePart(contract.params, "params", req.params),
          query: parsePart(contract.query, "query", req.query),
          body: parsePart(contract.body, "body", req.body),
        };
        const caller: Caller = {
          userId: req.authUser?.id ?? "",
          profile: req.profile ?? null,
          realProfile: req.realProfile ?? null,
          asOf: new Date(),
        };
        const result = await handler(input, caller);
        const output = validate(contract.output, result);
        // A mismatch here is our bug, not the caller's: surface it as a 500.
        if (!output.ok) {
          throw new Error(`${contract.method} ${contract.path} broke its contract: ${output.field} ${output.message}`);
        }
        res.json({ data: output.data });
      })
      .catch(next);
  };
  return { contract, handle: handle as RequestHandler };
}

/** Mount bound endpoints at the paths and methods their contracts declare. */
export function toRouter(endpoints: readonly BoundEndpoint[]): Router {
  const router = Router();
  for (const { contract, handle } of endpoints) {
    const method = contract.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
    router[method](contract.path, AUTH[contract.access], handle);
  }
  return router;
}
