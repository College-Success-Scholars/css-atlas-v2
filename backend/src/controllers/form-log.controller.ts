/**
 * @file form-log.controller.ts
 * @module backend/controllers
 *
 * Handlers for /api/form-logs, bound to @css-atlas/shared/contracts/form-logs.
 */
import * as contract from "@css-atlas/shared/contracts/form-logs";
import { hasRoleAtLeast } from "@css-atlas/shared/auth";
import { implement } from "../http/endpoint.js";
import {
  buildTeamLeaderFormStatsForWeek,
  getMcfFormLogById,
  getMcfFormLogsByUid,
  getMcfFormLogsByUids,
  getMcfFormLogsForWeekWithLate,
  getRecentFormSubmissions,
  getWhafFormLogsByUid,
  getWhafFormLogsByUids,
  getWhafFormLogsForWeekWithLate,
  getWplFormLogById,
  getWplFormLogsByUid,
  getWplFormLogsByUids,
  getWplFormLogsForWeekWithLate,
} from "../services/form-log.service.js";
import { fetchTeamLeaders } from "../services/user.service.js";
import { NotFoundError, ValidationError } from "../utils/domain-error.js";

export const formLogEndpoints = [
  implement(contract.getMcfByUid, ({ params }) => getMcfFormLogsByUid(params.uid)),
  implement(contract.getWahfByUid, ({ params }) => getWhafFormLogsByUid(params.uid)),
  implement(contract.getWplByUid, ({ params }) => getWplFormLogsByUid(params.uid)),

  implement(contract.getMcfWeekWithLate, ({ params }) => getMcfFormLogsForWeekWithLate(params.week_num)),
  implement(contract.getWahfWeekWithLate, ({ params }) => getWhafFormLogsForWeekWithLate(params.week_num)),
  implement(contract.getWplWeekWithLate, ({ params }) => getWplFormLogsForWeekWithLate(params.week_num)),

  implement(contract.getMcfByUids, ({ body }) => getMcfFormLogsByUids(body.uids ?? [], body.field ?? "mentor_uid")),
  implement(contract.getWahfByUids, ({ body }) => getWhafFormLogsByUids(body.uids ?? [])),
  implement(contract.getWplByUids, ({ body }) => getWplFormLogsByUids(body.uids ?? [])),

  implement(contract.getRecentSubmissions, ({ body }, caller) =>
    getRecentFormSubmissions({
      scholarId: body.scholarId || null,
      includeTeamLeaderForms: hasRoleAtLeast(caller.profile?.app_role ?? null, "team_leader"),
    }),
  ),

  implement(contract.getTeamLeaderStats, async ({ body }) => {
    const [leaders, mcfWithLate, wahfWithLate, wplWithLate] = await Promise.all([
      fetchTeamLeaders(),
      getMcfFormLogsForWeekWithLate(body.week_num),
      getWhafFormLogsForWeekWithLate(body.week_num),
      getWplFormLogsForWeekWithLate(body.week_num),
    ]);
    return buildTeamLeaderFormStatsForWeek(leaders, mcfWithLate, wahfWithLate, wplWithLate);
  }),

  implement(contract.getById, async ({ params }) => {
    if (params.form_type === "mcf") {
      const row = await getMcfFormLogById(params.id);
      if (!row) throw new NotFoundError({ resource: "MCF submission", id: params.id });
      return row;
    }
    const numericId = Number(params.id);
    if (Number.isNaN(numericId)) throw new ValidationError({ field: "id", message: "must be a number" });
    const row = await getWplFormLogById(numericId);
    if (!row) throw new NotFoundError({ resource: "WPL submission", id: params.id });
    return row;
  }),
];
