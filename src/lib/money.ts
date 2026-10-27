/** Parses a dollar amount typed by a person ("25", "25.5", "$25.50") into integer cents. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatCents(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** Platform fee in cents for a given charge, rounded down so organizers are never short-changed. */
export function platformFeeCents(amountCents: number, percent: number): number {
  if (percent <= 0) return 0;
  return Math.floor((amountCents * percent) / 100);
}
