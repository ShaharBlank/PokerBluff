export const MAX_PLAYERS = 10;
export const KINDS = [
  "single",
  "pair",
  "two-pair",
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
  "two-pair": "Two pair",
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
  if (kind === "two-pair")
    return `Pairs of ${rankName(rank)} and ${rankName(pairRank!)}`;
  return `${kind === "pair" ? "Pair of" : kind === "triple" ? "Three" : "Four"} ${rankName(rank)}`;
}

export function combinationCards(combination: Combination): Card[] {
  const count = {
    single: 1,
    pair: 2,
    "two-pair": 2,
    triple: 3,
    "full-house": 3,
    "four-kind": 4,
  }[combination.kind];
  const cards = Array.from({ length: count }, (_, suit) => ({
    rank: combination.rank,
    suit,
  }));
  if (combination.kind === "full-house" || combination.kind === "two-pair") {
    cards.push(
      { rank: combination.pairRank!, suit: 0 },
      { rank: combination.pairRank!, suit: 1 },
    );
  }
  return cards;
}

export function validCombination(value: unknown): value is Combination {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Combination;
  if (
    !KINDS.includes(candidate.kind) ||
    !Number.isInteger(candidate.rank) ||
    candidate.rank < 2 ||
    candidate.rank > 14
  ) return false;
  if (candidate.kind === "full-house" || candidate.kind === "two-pair")
    return (
      Number.isInteger(candidate.pairRank) &&
      candidate.pairRank! >= 2 &&
      candidate.pairRank! <= 14 &&
      candidate.pairRank !== candidate.rank &&
      (candidate.kind !== "two-pair" || candidate.rank > candidate.pairRank!)
    );
  return candidate.pairRank === undefined;
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
      : combination.kind === "pair" || combination.kind === "two-pair"
        ? 2
        : combination.kind === "four-kind"
          ? 4
          : 3;
  return (
    count >= needed &&
    ((combination.kind !== "full-house" && combination.kind !== "two-pair") ||
      cards.filter((card) => card.rank === combination.pairRank).length >= 2)
  );
}

export function highestCombination(cards: Card[]): Combination | null {
  for (const kind of [...KINDS].reverse()) {
    for (const rank of [...RANKS].reverse()) {
      if (kind === "full-house" || kind === "two-pair") {
        for (const pairRank of [...RANKS].reverse()) {
          const combination = { kind, rank, pairRank };
          if (
            validCombination(combination) &&
            combinationExists(combination, cards)
          )
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
      kind === "full-house" || kind === "two-pair"
        ? RANKS.filter((pairRank) =>
            kind === "two-pair" ? pairRank < rank : pairRank !== rank,
          ).map((pairRank) => ({
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
