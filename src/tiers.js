export function tierFor(n) {
  if (n <= 100) return 'room';
  if (n <= 10_000) return 'theater';
  if (n <= 1_000_000) return 'stadium';
  if (n <= 100_000_000) return 'city';
  return 'earth';
}
