/**
 * @file app-error.ts
 * @module backend/utils
 *
 * The one error type for failures a caller can act on. Services and handlers
 * throw it; nothing below the HTTP edge knows about status codes. The global
 * error handler in app.ts maps `kind` to a status.
 *
 * Throw these instead of `new Error(...)` whenever the caller did something
 * fixable. Anything else that is thrown is treated as a 500.
 */
export type AppErrorKind = "invalid" | "forbidden" | "not_found" | "conflict" | "unavailable";

export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** The request was understood but its values are not acceptable (400). */
export const invalid = (message: string) => new AppError("invalid", message);
/** The caller may not do this (403). */
export const forbidden = (message: string) => new AppError("forbidden", message);
/** The thing asked for does not exist (404). */
export const notFound = (message: string) => new AppError("not_found", message);
/** The request conflicts with current state (409). */
export const conflict = (message: string) => new AppError("conflict", message);
/** A dependency failed; retrying later may work (503). */
export const unavailable = (message: string) => new AppError("unavailable", message);

export const APP_ERROR_STATUS: Record<AppErrorKind, number> = {
  invalid: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unavailable: 503,
};
