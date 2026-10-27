import type Stripe from "stripe";
import { platformFeeCents } from "@/lib/money";
import type { TournamentRow } from "@/lib/supabase/database.types";

/** Stripe's minimum Checkout lifetime is 30 minutes; keep pending registrations short. */
export const CHECKOUT_LIFETIME_SECONDS = 30 * 60;

export interface CheckoutInput {
  tournament: Pick<TournamentRow, "id" | "slug" | "name" | "registration_fee_cents" | "currency">;
  teamId: string;
  teamName: string;
  captainEmail: string;
  appUrl: string;
  now: Date;
  /** Organizer's connected account for a destination charge. Omit to charge on the platform account. */
  destination?: { accountId: string; feePercent: number };
}

/** Builds the Checkout Session for one team's registration fee. Pure, so it is unit tested. */
export function buildCheckoutParams(input: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const { tournament, teamId, appUrl } = input;
  const metadata = { team_id: teamId, tournament_id: tournament.id };
  const amount = tournament.registration_fee_cents;

  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    metadata,
    description: `${tournament.name}: ${input.teamName}`,
  };
  if (input.destination) {
    paymentIntentData.transfer_data = { destination: input.destination.accountId };
    const fee = platformFeeCents(amount, input.destination.feePercent);
    if (fee > 0) paymentIntentData.application_fee_amount = fee;
  }

  return {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: tournament.currency,
          unit_amount: amount,
          product_data: { name: `${tournament.name} registration`, description: `Team: ${input.teamName}` },
        },
      },
    ],
    customer_email: input.captainEmail,
    client_reference_id: teamId,
    metadata,
    payment_intent_data: paymentIntentData,
    expires_at: Math.floor(input.now.getTime() / 1000) + CHECKOUT_LIFETIME_SECONDS,
    success_url: `${appUrl}/t/${tournament.slug}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/t/${tournament.slug}/register?cancelled=1`,
  };
}
