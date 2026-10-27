/** Smallest power of two that fits every team (minimum 2). */
export function bracketSize(teamCount: number): number {
  let size = 2;
  while (size < teamCount) size *= 2;
  return size;
}

/**
 * Standard bracket order of seeds for a bracket of `size` slots, e.g. 8 → [1, 8, 4, 5, 2, 7, 3, 6].
 * Adjacent pairs meet in round 1, the top two seeds can only meet in the final, and when the
 * bracket is not full, the missing (highest-numbered) seeds become byes for the top seeds.
 */
export function seedPositions(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error("Bracket size must be a power of two");
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, sum - seed]);
  }
  return order;
}
