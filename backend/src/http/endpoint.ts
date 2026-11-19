/**
 * @file endpoint.ts
 * @module backend/http
 *
 * Request handling for contract-backed endpoints. `implement` binds a handler
 * to a contract from @css-atlas/shared/contracts/*; this module owns the whole
 * request lifecycle:
 *
 *   authenticate + role check (from contract.access)
 *   → validate params, query, body        (ValidationError → 400)
 *   → run the handler with CurrentCaller provided
 *   → validate the result against contract.output (mismatch is our bug → 500)
 *   → { data } envelope
 *
 * A handler returns an Effect (preferred) or a Promise (unmigrated code). An
 * Effect handler's failures are limited to DomainError and its requirements
 * to CurrentCaller, so the compiler rejects anything this module cannot
 * handle or provide. This is the only place backend code runs an Effect.
 */
import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { Effect } from "effect";
import {
  validate,
  type Access,
  type Endpoint,
  type EndpointInput,
  type EndpointResult,
} from "@css-atlas/shared/contract";
import { CurrentCaller, type Caller } from "../context/current-caller.js";
import {
  requireAuth,
  requireDeveloper,
  requireTeamLeaderOrAbove,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { ValidationError, type DomainError } from "../utils/domain-error.js";

export type { Caller } from "../context/current-caller.js";

/**
 * A handler receives validated input and the caller, and returns either
 * - an Effect that succeeds with the contract's output, may fail only with a
 *   DomainError, and may require only CurrentCaller; or
 * - a Promise of the output (unmigrated code; throw a DomainError to fail).
 */
export type Handler<E extends Endpoint, Err extends DomainError = DomainError, Req extends CurrentCaller = never> = (
  input: EndpointInput<E>,
  caller: Caller,
) => Effect.Effect<EndpointResult<E>, Err, Req> | Promise<EndpointResult<E>>;

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

function callerFrom(req: AuthenticatedRequest, asOf: Date): Caller {
  const userId = req.authUser?.id ?? "";
  const studentId = req.profile?.student_id;
  return {
    userId,
    actorId: studentId != null ? String(studentId) : userId || null,
    profile: req.profile ?? null,
    realProfile: req.realProfile ?? null,
    asOf,
  };
}

function parsePart<T>(
  schema: Parameters<typeof validate>[0],
  part: string,
  value: unknown,
): Effect.Effect<T, ValidationError> {
  const result = validate(schema, value ?? {});
  return result.ok
    ? Effect.succeed(result.data as T)
    : Effect.fail(new ValidationError({ field: result.field || part, message: result.message }));
}

/** Bind a handler to its contract. */
export function implement<E extends Endpoint, Err extends DomainError = DomainError, Req extends CurrentCaller = never>(
  contract: E,
  handler: Handler<E, Err, Req>,
): BoundEndpoint {
  // Effect is covariant in its error and requirement types, so this widening is
  // safe, and it lets the compiler see that providing CurrentCaller leaves nothing.
  const run: Handler<E, DomainError, CurrentCaller> = handler;

  const handle = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const caller = callerFrom(req, new Date());

    const program = Effect.gen(function* () {
      const input: EndpointInput<E> = {
        params: yield* parsePart<EndpointInput<E>["params"]>(contract.params, "params", req.params),
        query: yield* parsePart<EndpointInput<E>["query"]>(contract.query, "query", req.query),
        body: yield* parsePart<EndpointInput<E>["body"]>(contract.body, "body", req.body),
      };

      const outcome = run(input, caller);
      const result: EndpointResult<E> = Effect.isEffect(outcome)
        ? yield* outcome
        : yield* Effect.promise(() => outcome);

      const output = validate(contract.output, result);
      if (!output.ok) {
        return yield* Effect.die(
          new Error(`${contract.method} ${contract.path} broke its contract: ${output.field} ${output.message}`),
        );
      }
      return output.data;
    }).pipe(
      Effect.provideService(CurrentCaller, caller),
      Effect.withSpan(`${contract.method} ${contract.path}`),
    );

    // Failures and defects reject with the original error; error-handler.ts maps it.
    Effect.runPromise(program).then((data) => res.json({ data }), next);
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
