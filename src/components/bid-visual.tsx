import { combinationCards, combinationLabel } from "@/lib/rules";
import type { Combination } from "@/lib/rules";
import { PlayingCard } from "./playing-card";

export function BidVisual({
  combination,
  size = "table",
}: {
  combination: Combination;
  size?: "table" | "seat" | "preview" | "sidebar";
}) {
  return (
    <div className={`bid-visual bid-visual-${size}`}>
      <div
        className="bid-visual-cards"
        aria-hidden="true"
        key={`${combination.kind}-${combination.rank}-${combination.pairRank ?? ""}`}
      >
        {combinationCards(combination).map((card) => (
          <PlayingCard key={`${card.rank}-${card.suit}`} {...card} />
        ))}
      </div>
      <span className="bid-visual-label">{combinationLabel(combination)}</span>
    </div>
  );
}
