export const KINDS = [
  "single",
  "pair",
  "triple",
  "full-house",
  "four-kind",
] as const;
export type Kind = (typeof KINDS)[number];
export type Card = { rank: number; suit: number };
export type Combination = { kind: Kind; rank: number; pairRank?: number };
export const KIND_NAMES: Record<Kind, string> = {
  single: "Single",
  pair: "Pair",
  triple: "Triple",
  "full-house": "Full house",
  "four-kind": "Four of a kind",
};
export const RANKS = Array.from({ length: 13 }, (_, i) => i + 2);
export const rankLabel = (rank: number) =>
  ({ 11: "J", 12: "Q", 13: "K", 14: "A" })[rank] ?? String(rank);
const rankNames: Record<number, string> = {
  11: "Jacks",
  12: "Queens",
  13: "Kings",
  14: "Aces",
};
export const rankName = (rank: number) => rankNames[rank] ?? `${rank}s`;

export function combinationLabel(combination: Combination): string {
  const { kind, rank, pairRank } = combination;
  if (kind === "single") return `${rankLabel(rank)} high`;
  if (kind === "full-house")
    return `${rankName(rank)} full of ${rankName(pairRank!)}`;
  return `${kind === "pair" ? "Pair of" : kind === "triple" ? "Three" : "Four"} ${rankName(rank)}`;
}

export function validCombination(value: unknown): value is Combination {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Combination;
  return (
    KINDS.includes(candidate.kind) &&
    Number.isInteger(candidate.rank) &&
    candidate.rank >= 2 &&
    candidate.rank <= 14 &&
    (candidate.kind !== "full-house" ||
      (Number.isInteger(candidate.pairRank) &&
        candidate.pairRank! >= 2 &&
        candidate.pairRank! <= 14 &&
        candidate.pairRank !== candidate.rank))
  );
}

export function compareCombinations(a: Combination, b: Combination): number {
  return (
    KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
    a.rank - b.rank ||
    (a.pairRank ?? 0) - (b.pairRank ?? 0)
  );
}

export function combinationExists(
  combination: Combination,
  cards: Card[],
): boolean {
  const count = cards.filter((card) => card.rank === combination.rank).length;
  const needed =
    combination.kind === "single"
      ? 1
      : combination.kind === "pair"
        ? 2
        : combination.kind === "four-kind"
          ? 4
          : 3;
  return (
    count >= needed &&
    (combination.kind !== "full-house" ||
      cards.filter((card) => card.rank === combination.pairRank).length >= 2)
  );
}

export function highestCombination(cards: Card[]): Combination | null {
  for (const kind of [...KINDS].reverse()) {
    for (const rank of [...RANKS].reverse()) {
      if (kind === "full-house") {
        for (const pairRank of [...RANKS].reverse()) {
          const combination = { kind, rank, pairRank };
          if (rank !== pairRank && combinationExists(combination, cards))
            return combination;
        }
      } else {
        const combination = { kind, rank };
        if (combinationExists(combination, cards)) return combination;
      }
    }
  }
  return null;
}

export function availableBids(previous: Combination | null): Combination[] {
  return KINDS.flatMap<Combination>((kind) =>
    RANKS.flatMap<Combination>((rank) =>
      kind === "full-house"
        ? RANKS.filter((pairRank) => pairRank !== rank).map((pairRank) => ({
            kind,
            rank,
            pairRank,
          }))
        : [{ kind, rank }],
    ),
  ).filter(
    (combination) =>
      !previous || compareCombinations(combination, previous) > 0,
  );
}
