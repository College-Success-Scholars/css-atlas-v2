/**
 * @file contract.ts
 * @module shared
 *
 * The API contract: one description of each Express endpoint that both apps
 * derive from. The backend validates requests and responses against it
 * (backend/src/http/endpoint.ts); the frontend gets typed calls from it
 * (frontend/lib/server/api-client.ts → callEndpoint).
 *
 * An endpoint is described once, in shared/contracts/<domain>.ts. Do not
 * restate its path, input or output shape anywhere else.
 */
import { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Minimum role allowed to call an endpoint. Every endpoint requires a signed-in user. */
export type Access = "authenticated" | "team_leader" | "developer";

const empty = z.object({});
type Empty = typeof empty;

export interface Endpoint<
  P extends z.ZodType = z.ZodType,
  Q extends z.ZodType = z.ZodType,
  B extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
> {
  readonly method: HttpMethod;
  /** Full path with Express-style params, e.g. "/api/attendance/week/:week_num". */
  readonly path: string;
  readonly access: Access;
  readonly params: P;
  readonly query: Q;
  readonly body: B;
  readonly output: O;
}

/** Describe one endpoint. Omitted `params`, `query` and `body` mean "none". */
export function endpoint<
  O extends z.ZodType,
  P extends z.ZodType = Empty,
  Q extends z.ZodType = Empty,
  B extends z.ZodType = Empty,
>(definition: {
  method: HttpMethod;
  path: string;
  access: Access;
  params?: P;
  query?: Q;
  body?: B;
  output: O;
}): Endpoint<P, Q, B, O> {
  return {
    method: definition.method,
    path: definition.path,
    access: definition.access,
    params: (definition.params ?? empty) as P,
    query: (definition.query ?? empty) as Q,
    body: (definition.body ?? empty) as B,
    output: definition.output,
  };
}

/** What a handler receives: the request after validation. */
export type EndpointInput<E extends Endpoint> = {
  params: z.output<E["params"]>;
  query: z.output<E["query"]>;
  body: z.output<E["body"]>;
};

/** What the endpoint returns inside the `{ data }` envelope. */
export type EndpointOutput<E extends Endpoint> = z.output<E["output"]>;

type Part<K extends string, T> = Record<string, never> extends T ? { [key in K]?: T } : { [key in K]: T };

/** What a caller sends. Parts with no fields may be omitted. */
export type EndpointRequest<E extends Endpoint> = Part<"params", z.input<E["params"]>> &
  Part<"query", z.input<E["query"]>> &
  Part<"body", z.input<E["body"]>>;

/** Build the request path (with query string) for an endpoint. */
export function endpointPath(
  contract: Endpoint,
  request: { params?: unknown; query?: unknown },
): string {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const path = contract.path.replace(/:([A-Za-z_]+)/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) throw new Error(`Missing path parameter "${name}" for ${contract.path}`);
    return encodeURIComponent(String(value));
  });
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries((request.query ?? {}) as Record<string, unknown>)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

/** A campus week number. Accepts a number or a numeric string (path and query values arrive as strings). */
export const campusWeekNumber = z
  .union([z.number(), z.string().regex(/^\d+$/, "must be a whole number")])
  .transform(Number)
  .pipe(z.number().int().min(1, "must be a campus week number of 1 or more"));

/** A Scholar ID (University ID). */
export const scholarId = z.string().trim().min(1, "is required").max(50);

// ---------------------------------------------------------------------------
// Validation helpers — so the apps never import the schema library themselves
// ---------------------------------------------------------------------------

/** What a handler may return: anything the endpoint's output schema accepts. */
export type EndpointResult<E extends Endpoint> = z.input<E["output"]>;

export type Validated<T> = { ok: true; data: T } | { ok: false; field: string; message: string };

/** Validate one value against a contract schema, reporting the first problem as field + message. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): Validated<z.output<S>> {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  return {
    ok: false,
    field: issue?.path.length ? issue.path.join(".") : "",
    message: issue?.message ?? "is invalid",
  };
}
