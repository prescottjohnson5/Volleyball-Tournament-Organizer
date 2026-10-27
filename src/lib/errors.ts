/**
 * An error caused by the caller breaking a rule (not a bug), whose message is safe to show.
 * Pure modules throw these; API routes turn them into responses with `status` (422 by default).
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly status: number = 422,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}
