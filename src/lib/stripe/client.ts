import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env";

let client: Stripe | undefined;

/** Server-side Stripe client. Test-mode keys only (enforced by getStripeSecretKey). */
export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(getStripeSecretKey(), {
      appInfo: { name: "Volleyball Tournament Organizer" },
      maxNetworkRetries: 2,
    });
  }
  return client;
}
