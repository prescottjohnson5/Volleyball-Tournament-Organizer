/**
 * An error caused by the caller breaking a rule (not a bug), whose message is safe to show.
 * Pure modules throw these; API routes turn them into 422 responses.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
