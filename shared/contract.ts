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
 *
 * Schemas are Effect Schema. Both apps import `Schema` from this module, not
 * from "effect", and decode only with `validate()`: shared has its own copy of
 * effect, so a schema must never be handed to another copy's decoder.
 */
import { Result, Schema, SchemaIssue, SchemaTransformation } from "effect";

export { Schema, SchemaTransformation };

/** Any schema a contract can use: decodes without services. */
export type ContractSchema = Schema.Codec<unknown, unknown>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Who may call an endpoint. Every endpoint requires a signed-in user.
 *
 * - "authenticated" / "team_leader" / "developer": that role or above.
 * - `{ selfOrTeamLeader: "params.uid" }`: a team leader, or the scholar whose
 *   Scholar ID is at that path of the validated input. A missing value is
 *   allowed through; the handler decides what an absent ID means.
 */
export type Access =
  | "authenticated"
  | "team_leader"
  | "developer"
  | { readonly selfOrTeamLeader: `${"params" | "query" | "body"}.${string}` };

/** One line describing an endpoint's access, e.g. for the route inventory. */
export function accessLabel(access: Access): string {
  return typeof access === "string" ? access : `self_or_team_leader(${access.selfOrTeamLeader})`;
}

const empty = Schema.Struct({});
type Empty = typeof empty;

/** A JSON endpoint answers `{ data }`; a download answers a file. */
export type EndpointKind = "json" | "download";

export interface Endpoint<
  P extends ContractSchema = ContractSchema,
  Q extends ContractSchema = ContractSchema,
  B extends ContractSchema = ContractSchema,
  O extends ContractSchema = ContractSchema,
> {
  readonly kind: EndpointKind;
  readonly method: HttpMethod;
  /** Full path with Express-style params, e.g. "/api/attendance/week/:week_num". */
  readonly path: string;
  readonly access: Access;
  readonly params: P;
  readonly query: Q;
  readonly body: B;
  readonly output: O;
  /** Success status. Defaults to 200. */
  readonly status: number;
  /** Extra response headers, e.g. Cache-Control. */
  readonly headers: Readonly<Record<string, string>>;
}

interface Definition<P, Q, B> {
  method: HttpMethod;
  path: string;
  access: Access;
  params?: P;
  query?: Q;
  body?: B;
  status?: number;
  headers?: Record<string, string>;
}

function define<P extends ContractSchema, Q extends ContractSchema, B extends ContractSchema, O extends ContractSchema>(
  kind: EndpointKind,
  definition: Definition<P, Q, B>,
  output: O,
): Endpoint<P, Q, B, O> {
  return {
    kind,
    method: definition.method,
    path: definition.path,
    access: definition.access,
    params: (definition.params ?? empty) as P,
    query: (definition.query ?? empty) as Q,
    body: (definition.body ?? empty) as B,
    output,
    status: definition.status ?? 200,
    headers: definition.headers ?? {},
  };
}

/** Describe one JSON endpoint. Omitted `params`, `query` and `body` mean "none". */
export function endpoint<
  O extends ContractSchema,
  P extends ContractSchema = Empty,
  Q extends ContractSchema = Empty,
  B extends ContractSchema = Empty,
>(definition: Definition<P, Q, B> & { output: O }): Endpoint<P, Q, B, O> {
  return define("json", definition, definition.output);
}

/** A file the handler produces: sent as-is with these headers, not wrapped in `{ data }`. */
export const downloadFile = Schema.Struct({
  contentType: Schema.String,
  filename: Schema.String,
  body: Schema.Uint8Array,
});
export type DownloadFile = typeof downloadFile.Type;

/** Describe an endpoint that answers with a file (PDF export and the like). */
export function download<P extends ContractSchema = Empty, Q extends ContractSchema = Empty>(
  definition: Omit<Definition<P, Q, Empty>, "body">,
): Endpoint<P, Q, Empty, typeof downloadFile> {
  return define("download", definition, downloadFile);
}

/** What a handler receives: the request after validation. */
export type EndpointInput<E extends Endpoint> = {
  params: E["params"]["Type"];
  query: E["query"]["Type"];
  body: E["body"]["Type"];
};

/** What the endpoint returns inside the `{ data }` envelope. */
export type EndpointOutput<E extends Endpoint> = E["output"]["Type"];

type Part<K extends string, T> = Record<string, never> extends T ? { [key in K]?: T } : { [key in K]: T };

/** What a caller sends. Parts with no fields may be omitted. */
export type EndpointRequest<E extends Endpoint> = Part<"params", E["params"]["Encoded"]> &
  Part<"query", E["query"]["Encoded"]> &
  Part<"body", E["body"]["Encoded"]>;

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
    if (value === undefined || value === null) continue;
    // Repeat the key for arrays (?uids=a&uids=b), which Express parses back into an array.
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) search.append(key, String(item));
    }
  }
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const WHOLE_NUMBER = "must be a whole number";

/** A campus week number. Accepts a number or a numeric string (path and query values arrive as strings). */
export const campusWeekNumber = Schema.Union([
  Schema.Number,
  Schema.String.check(Schema.isPattern(/^\d+$/, { message: WHOLE_NUMBER })).pipe(
    Schema.decodeTo(Schema.Number, SchemaTransformation.numberFromString),
  ),
]).check(
  Schema.isInt({ message: WHOLE_NUMBER }),
  Schema.isGreaterThanOrEqualTo(1, { message: "must be a campus week number of 1 or more" }),
);

/** A Scholar ID (University ID), trimmed. */
export const scholarId = Schema.Trim.check(
  Schema.isMinLength(1, { message: "is required" }),
  Schema.isMaxLength(50, { message: "must be 50 characters or fewer" }),
);

// ---------------------------------------------------------------------------
// Validation helpers — so the apps never import the schema library themselves
// ---------------------------------------------------------------------------

/** What a handler may return: anything that encodes to the endpoint's output. */
export type EndpointResult<E extends Endpoint> = E["output"]["Type"];

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
}

export type Validated<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      /** The first failing field path ("" when the value as a whole is invalid). */
      readonly field: string;
      /** The first failing message. */
      readonly message: string;
      /** Every problem found, in order. */
      readonly issues: readonly ValidationIssue[];
    };

const toIssues = SchemaIssue.makeFormatterStandardSchemaV1({
  // Messages are read as "<field> <message>", so a missing field "is required".
  leafHook: (issue) => (issue._tag === "MissingKey" ? "is required" : SchemaIssue.defaultLeafHook(issue)),
});

/** Validate one value against a contract schema, reporting the first problem and all of them. */
export function validate<S extends ContractSchema>(schema: S, value: unknown): Validated<S["Type"]> {
  const result = Schema.decodeUnknownResult(schema, { errors: "all" })(value);
  if (Result.isSuccess(result)) return { ok: true, data: result.success };
  const issues = toIssues(result.failure.issue).issues.map((issue) => ({
    field: (issue.path ?? []).map((key) => String(typeof key === "object" ? key.key : key)).join("."),
    message: issue.message,
  }));
  return { ok: false, field: issues[0]?.field ?? "", message: issues[0]?.message ?? "is invalid", issues };
}
