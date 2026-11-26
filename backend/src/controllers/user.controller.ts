/**
 * @file user.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/users, bound to @css-atlas/shared/contracts/users.
 */
import * as contract from "@css-atlas/shared/contracts/users";
import { implement } from "../http/endpoint.js";
import {
  fetchAllUsersForMemo,
  fetchTeamLeaders,
  getDirectory,
  getDirectoryFacets,
  getUserByUid,
} from "../services/user.service.js";
import type { DirectoryQuery } from "../models/user.model.js";
import { NotFoundError } from "../utils/domain-error.js";

/** Fills in the directory defaults: flat view, A to Z, one page. */
function toDirectoryQuery(query: contract.DirectoryQueryInput): DirectoryQuery {
  return {
    view: query.view ?? "flat",
    search: query.search ?? "",
    sort: query.sort ?? "asc",
    teams: query.team ?? [],
    programRoles: query.programRole ?? [],
    cohorts: query.cohort ?? [],
    limit: query.limit ?? contract.DIRECTORY_PAGE_SIZE,
    cursor: query.cursor ?? null,
    group: query.group ?? null,
  };
}

export const userEndpoints = [
  implement(contract.getMemoUsers, () => fetchAllUsersForMemo()),

  implement(contract.getTeamLeaders, () => fetchTeamLeaders()),

  implement(contract.getDirectory, ({ query }) => getDirectory(toDirectoryQuery(query))),

  implement(contract.getDirectoryFacets, () => getDirectoryFacets()),

  // Last: `:uid` would otherwise match the fixed paths above.
  implement(contract.getUser, async ({ params }) => {
    const user = await getUserByUid(params.uid);
    if (!user) throw new NotFoundError({ resource: "User" });
    return user;
  }),
];
