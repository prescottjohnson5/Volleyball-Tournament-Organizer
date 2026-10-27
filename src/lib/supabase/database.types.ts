/**
 * Hand-maintained types that mirror supabase/migrations. Keep in sync when a migration changes.
 * (They follow the shape `supabase gen types` produces, so they can be swapped for generated
 * types later without touching call sites.)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Environment = "indoor" | "outdoor";
export type FormatId = "pool_to_single_elim" | "double_elim";
export type TournamentStatus = "registration" | "in_progress" | "completed";
export type PaymentStatus = "pending" | "paid" | "expired" | "refunded";
export type MatchPhase = "pool" | "bracket";
export type BracketSide = "pool" | "winners" | "losers" | "final";
export type MatchStatus = "pending" | "ready" | "in_progress" | "completed" | "bye" | "not_needed";
export type Reporter = "captain" | "organizer";

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type OrganizerProfileRow = {
  id: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  created_at: string;
  updated_at: string;
};

export type TournamentRow = {
  id: string;
  organizer_id: string;
  slug: string;
  name: string;
  event_date: string;
  location: string;
  environment: Environment;
  format: FormatId;
  format_options: Json;
  best_of: number;
  max_teams: number;
  registration_fee_cents: number;
  currency: string;
  status: TournamentStatus;
  version: number;
  champion_team_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamRow = {
  id: string;
  tournament_id: string;
  name: string;
  payment_status: PaymentStatus;
  seed: number | null;
  pool: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
};

export type TeamPrivateRow = {
  team_id: string;
  tournament_id: string;
  captain_name: string;
  captain_email: string;
  captain_token_hash: string | null;
  captain_token_created_at: string | null;
};

export type MatchRow = {
  id: string;
  tournament_id: string;
  phase: MatchPhase;
  bracket: BracketSide;
  round: number;
  position: number;
  pool: string | null;
  label: string;
  order_index: number;
  team_a_source: Json;
  team_b_source: Json;
  reset_of_match_id: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_id: string | null;
  status: MatchStatus;
  sets_a: number;
  sets_b: number;
  created_at: string;
  updated_at: string;
};

export type MatchSetRow = {
  id: string;
  match_id: string;
  tournament_id: string;
  set_number: number;
  score_a: number;
  score_b: number;
  reported_by: Reporter;
  reported_by_team_id: string | null;
  reported_by_user_id: string | null;
  reported_at: string;
};

export type StripeEventRow = {
  id: string;
  type: string;
  processed_at: string;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      organizer_profiles: Table<
        OrganizerProfileRow,
        Optional<
          OrganizerProfileRow,
          "stripe_account_id" | "stripe_charges_enabled" | "stripe_details_submitted" | "created_at" | "updated_at"
        >
      >;
      tournaments: Table<
        TournamentRow,
        Optional<
          TournamentRow,
          | "id"
          | "format_options"
          | "best_of"
          | "currency"
          | "status"
          | "version"
          | "champion_team_id"
          | "started_at"
          | "completed_at"
          | "created_at"
          | "updated_at"
        >
      >;
      teams: Table<
        TeamRow,
        Optional<
          TeamRow,
          | "id"
          | "payment_status"
          | "seed"
          | "pool"
          | "stripe_checkout_session_id"
          | "stripe_payment_intent_id"
          | "paid_at"
          | "created_at"
        >
      >;
      team_private: Table<
        TeamPrivateRow,
        Optional<TeamPrivateRow, "captain_token_hash" | "captain_token_created_at">
      >;
      matches: Table<
        MatchRow,
        Optional<
          MatchRow,
          | "id"
          | "pool"
          | "reset_of_match_id"
          | "team_a_id"
          | "team_b_id"
          | "winner_id"
          | "status"
          | "sets_a"
          | "sets_b"
          | "created_at"
          | "updated_at"
        >
      >;
      match_sets: Table<
        MatchSetRow,
        Optional<MatchSetRow, "id" | "reported_by_team_id" | "reported_by_user_id" | "reported_at">
      >;
      stripe_events: Table<StripeEventRow, Optional<StripeEventRow, "processed_at">>;
    };
    Views: { [_ in never]: never };
    Functions: {
      confirm_team_payment: {
        Args: { p_checkout_session_id: string; p_payment_intent_id: string };
        Returns: string;
      };
      commit_tournament_changes: {
        Args: { p_tournament_id: string; p_expected_version: number; p_changes: Json };
        Returns: number;
      };
      register_free_team: {
        Args: {
          p_tournament_id: string;
          p_team_name: string;
          p_captain_name: string;
          p_captain_email: string;
          p_captain_token_hash: string;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
