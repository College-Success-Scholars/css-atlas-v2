/**
 * @file semester.controller.ts
 * @module backend/controllers
 *
 * Handler for GET /api/auth/semester, bound to @css-atlas/shared/contracts/auth.
 */
import * as contract from "@css-atlas/shared/contracts/auth";
import { implement } from "../http/endpoint.js";
import { getActiveSemesterRow } from "../services/semester.service.js";

export const semesterEndpoints = [
  implement(contract.getSemester, async () => {
    const semester = await getActiveSemesterRow();
    if (!semester) throw new Error("No active semester");
    return semester;
  }),
];
