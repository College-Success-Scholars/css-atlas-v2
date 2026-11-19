/**
 * @file domain-error.ts
 * @module backend/utils
 *
 * The closed set of failures a caller can act on. Effect services fail with
 * them (`return yield* new NotFoundError({ ... })`), so each one shows up in
 * the function's type; Promise code may `throw` them during migration.
 *
 * Nothing here knows about HTTP. http/error-handler.ts maps each `_tag` to a
 * status in one place. Anything thrown that is not one of these is a 500.
 */
import { Data } from "effect";

/** The request was understood but a value is not acceptable. */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
}> {}

/** The thing asked for does not exist. */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id?: string;
}> {}

/** The caller may not do this. */
export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  readonly reason: string;
}> {}

/** The request conflicts with the current state. */
export class ConflictError extends Data.TaggedError("ConflictError")<{
  readonly message: string;
}> {}

export type DomainError = ValidationError | NotFoundError | ForbiddenError | ConflictError;

export function isDomainError(error: unknown): error is DomainError {
  return (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ForbiddenError ||
    error instanceof ConflictError
  );
}
