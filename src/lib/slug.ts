const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alike characters (l, o, 0, 1)

function randomSuffix(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Builds the public URL slug for a tournament: a readable part from the name plus a random
 * suffix, so links are shareable but not guessable by incrementing an id.
 */
export function createTournamentSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return `${base || "tournament"}-${randomSuffix(6)}`;
}
