/**
 * @file contracts/users.ts
 * @module shared/contracts
 *
 * Contract for /api/users — the roster as other pages read it: Memo users,
 * team leaders, one user by Scholar ID, and the searchable Directory.
 */
import { endpoint, Schema, SchemaTransformation, wholeNumber } from "../contract.js";

export const DIRECTORY_PAGE_SIZE = 24;

const memoUserFields = {
  uid: Schema.String,
  first_name: Schema.NullOr(Schema.String),
  last_name: Schema.NullOr(Schema.String),
  cohort: Schema.NullOr(Schema.Number),
  program_role: Schema.NullOr(Schema.String),
  fd_required: Schema.NullOr(Schema.Number),
  ss_required: Schema.NullOr(Schema.Number),
  status: Schema.NullOr(Schema.String),
};

export const memoUserRow = Schema.Struct({
  ...memoUserFields,
  app_role: Schema.NullOr(Schema.String),
});
export type MemoUserRow = typeof memoUserRow.Type;

export const teamLeaderRow = Schema.Struct({
  ...memoUserFields,
  mentee_count: Schema.NullOr(Schema.Number),
});
export type TeamLeaderRow = typeof teamLeaderRow.Type;

/** The only person fields the directory exposes. */
export const directoryPerson = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  uid: Schema.NullOr(Schema.String),
  cohort: Schema.NullOr(Schema.Number),
  email: Schema.NullOr(Schema.String),
  phoneNumber: Schema.NullOr(Schema.String),
  teams: Schema.Array(Schema.String),
  programRole: Schema.NullOr(Schema.String),
  /** True when `mentor_mentee` has at least one assignment. RLS hides this from non-leaders. */
  isMentee: Schema.Boolean,
});
export type DirectoryPerson = typeof directoryPerson.Type;

export const directoryPagination = Schema.Struct({
  total: Schema.Number,
  range: Schema.Struct({ start: Schema.Number, end: Schema.Number }),
  hasNext: Schema.Boolean,
  nextCursor: Schema.NullOr(Schema.String),
});
export type DirectoryPagination = typeof directoryPagination.Type;

export const directoryFlatResponse = Schema.Struct({
  view: Schema.Literal("flat"),
  members: Schema.Array(directoryPerson),
  pagination: directoryPagination,
});
export type DirectoryFlatResponse = typeof directoryFlatResponse.Type;

export const directoryGroup = Schema.Struct({
  team: Schema.String,
  members: Schema.Array(directoryPerson),
  pagination: directoryPagination,
});
export type DirectoryGroup = typeof directoryGroup.Type;

export const directoryGroupedResponse = Schema.Struct({
  view: Schema.Literal("grouped"),
  total: Schema.Number,
  groups: Schema.Array(directoryGroup),
});
export type DirectoryGroupedResponse = typeof directoryGroupedResponse.Type;

export const directoryResponse = Schema.Union([directoryFlatResponse, directoryGroupedResponse]);
export type DirectoryResponse = typeof directoryResponse.Type;

/** Distinct filter-facet values for the Directory page's team/role/cohort dropdowns. */
export const directoryFacets = Schema.Struct({
  teams: Schema.Array(Schema.String),
  programRoles: Schema.Array(Schema.String),
  cohorts: Schema.Array(Schema.Number),
});
export type DirectoryFacets = typeof directoryFacets.Type;

const trimmed = (maxLength: number) =>
  Schema.String.check(Schema.isMaxLength(maxLength, { message: `must be ${maxLength} characters or fewer` })).pipe(
    Schema.decodeTo(
      Schema.String,
      SchemaTransformation.transform({ decode: (text: string) => text.trim(), encode: (text: string) => text }),
    ),
  );

/**
 * A facet filter: one value, comma-separated values, or a repeated parameter.
 * Decodes to the distinct trimmed values; none may be blank or longer than `maxLength`.
 */
const facet = (maxLength: number) =>
  Schema.Union([
    Schema.String,
    Schema.Array(Schema.String).check(
      Schema.isMaxLength(DIRECTORY_PAGE_SIZE, { message: `must have ${DIRECTORY_PAGE_SIZE} values or fewer` }),
    ),
  ]).pipe(
    Schema.decodeTo(
      Schema.Array(Schema.String).check(
        Schema.makeFilter((values: ReadonlyArray<string>) =>
          values.every((value) => value && value.length <= maxLength)
            ? undefined
            : `must be non-blank values of ${maxLength} characters or fewer`,
        ),
      ),
      SchemaTransformation.transform<ReadonlyArray<string>, string | ReadonlyArray<string>>({
        decode: (value) => [
          ...new Set((typeof value === "string" ? [value] : value).flatMap((item) => item.split(",")).map((item) => item.trim())),
        ],
        encode: (values) => values,
      }),
    ),
  );

const cohortFacet = facet(4).pipe(
  Schema.decodeTo(
    Schema.Array(Schema.Number).check(
      Schema.makeFilter((cohorts: ReadonlyArray<number>) =>
        cohorts.every((cohort) => Number.isInteger(cohort) && cohort >= 1900 && cohort <= 3000)
          ? undefined
          : "must be years from 1900 to 3000",
      ),
    ),
    SchemaTransformation.transform<ReadonlyArray<number>, ReadonlyArray<string>>({
      decode: (values) => values.map((value) => Number(value)),
      encode: (cohorts) => cohorts.map(String),
    }),
  ),
);

/**
 * Directory search, filter and paging. Every parameter is optional; the handler
 * applies the defaults (flat view, A to Z, one page of 24). `cursor` is opaque.
 * Exported so the client and tests can run the same validation.
 */
export const directoryQuery = Schema.Struct({
  view: Schema.optional(Schema.Literals(["flat", "grouped"]).annotate({ message: "must be flat or grouped" })),
  search: Schema.optional(trimmed(100)),
  sort: Schema.optional(Schema.Literals(["asc", "desc"]).annotate({ message: "must be asc or desc" })),
  team: Schema.optional(facet(100)),
  programRole: Schema.optional(facet(100)),
  cohort: Schema.optional(cohortFacet),
  limit: Schema.optional(
    wholeNumber(1, `must be between 1 and ${DIRECTORY_PAGE_SIZE}`).check(
      Schema.isLessThanOrEqualTo(DIRECTORY_PAGE_SIZE, { message: `must be between 1 and ${DIRECTORY_PAGE_SIZE}` }),
    ),
  ),
  cursor: Schema.optional(
    Schema.String.check(
      Schema.isMinLength(1, { message: "must not be empty" }),
      Schema.isMaxLength(500, { message: "must be 500 characters or fewer" }),
    ),
  ),
  /** One team group to page after it has been expanded (grouped view only). */
  group: Schema.optional(
    Schema.String.check(
      Schema.makeFilter((group: string) => (group.trim() ? undefined : "must not be blank")),
      Schema.isMaxLength(100, { message: "must be 100 characters or fewer" }),
    ).pipe(
      Schema.decodeTo(
        Schema.String,
        SchemaTransformation.transform({ decode: (text: string) => text.trim(), encode: (text: string) => text }),
      ),
    ),
  ),
}).check(
  Schema.makeFilter((query) => {
    const view = query.view ?? "flat";
    if (view === "flat" && query.group !== undefined) return { path: ["group"], issue: "is only allowed in the grouped view" };
    if (view === "grouped" && query.cursor !== undefined && query.group === undefined) {
      return { path: ["group"], issue: "is required to page a grouped view" };
    }
    return undefined;
  }),
);
export type DirectoryQueryInput = typeof directoryQuery.Type;

/** Every roster user the Memo and schedule pages work from. */
export const getMemoUsers = endpoint({
  method: "GET",
  path: "/api/users/memo-users",
  access: "authenticated",
  output: Schema.Array(memoUserRow),
});

/** Enrolled roster members who are not Scholars. */
export const getTeamLeaders = endpoint({
  method: "GET",
  path: "/api/users/team-leaders",
  access: "authenticated",
  output: Schema.Array(teamLeaderRow),
});

export const getDirectory = endpoint({
  method: "GET",
  path: "/api/users/directory",
  access: "authenticated",
  query: directoryQuery,
  output: directoryResponse,
});

export const getDirectoryFacets = endpoint({
  method: "GET",
  path: "/api/users/directory/facets",
  access: "authenticated",
  output: directoryFacets,
});

/** One roster user by Scholar ID. Declared last: `:uid` also matches the paths above. */
export const getUser = endpoint({
  method: "GET",
  path: "/api/users/:uid",
  access: "authenticated",
  params: Schema.Struct({ uid: Schema.String.check(Schema.isMinLength(1, { message: "is required" })) }),
  output: memoUserRow,
});
