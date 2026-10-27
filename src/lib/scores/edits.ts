import { UserFacingError } from "@/lib/errors";
import type { MatchRow, MatchSetRow, TournamentRow } from "@/lib/supabase/database.types";
import type { ScoreEdit } from "@/lib/tournament/progress";

interface EditContext {
  tournament: Pick<TournamentRow, "status">;
  matches: readonly Pick<MatchRow, "id" | "team_a_id" | "team_b_id">[];
  sets: readonly Pick<MatchSetRow, "match_id" | "set_number">[];
}

/**
 * A captain reports the next completed set of one of their own matches. Set numbers must be
 * consecutive, so when both captains report the same set at once, the second gets a clear
 * "already reported" message instead of a duplicate. Score validity is checked by planScoreEdit.
 */
export function buildCaptainEdit(
  context: EditContext,
  teamId: string,
  matchId: string,
  input: { setNumber: number; scoreA: number; scoreB: number },
): ScoreEdit {
  if (context.tournament.status === "completed") throw new UserFacingError("This tournament is finished.", 409);
  if (context.tournament.status !== "in_progress") throw new UserFacingError("This tournament has not started yet.", 409);

  const match = context.matches.find((m) => m.id === matchId);
  if (!match) throw new UserFacingError("Match not found.", 404);
  if (match.team_a_id !== teamId && match.team_b_id !== teamId) {
    throw new UserFacingError("Your team is not playing in this match.", 403);
  }

  const reported = context.sets.filter((s) => s.match_id === matchId).length;
  if (input.setNumber <= reported) {
    throw new UserFacingError(`Set ${input.setNumber} was already reported. Refresh to see the latest score.`, 409);
  }
  if (input.setNumber > reported + 1) throw new UserFacingError(`Report set ${reported + 1} first.`);

  return {
    matchId,
    append: [
      {
        set_number: input.setNumber,
        score_a: input.scoreA,
        score_b: input.scoreB,
        reported_by: "captain",
        reported_by_team_id: teamId,
        reported_by_user_id: null,
      },
    ],
  };
}

/** The organizer replaces every set of a match (an empty list clears it). */
export function buildOrganizerOverride(
  context: Pick<EditContext, "matches">,
  matchId: string,
  sets: readonly { a: number; b: number }[],
  organizerId: string,
): ScoreEdit {
  if (!context.matches.some((m) => m.id === matchId)) throw new UserFacingError("Match not found.", 404);
  return {
    matchId,
    replace: sets.map((set, i) => ({
      set_number: i + 1,
      score_a: set.a,
      score_b: set.b,
      reported_by: "organizer",
      reported_by_team_id: null,
      reported_by_user_id: organizerId,
    })),
  };
}
