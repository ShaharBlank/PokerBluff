"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";

export function Rules({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="rules-dialog"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="rules-content">
        <button
          className="icon-button rules-close"
          onClick={onClose}
          aria-label="Close rules"
        >
          <Icon name="close" />
        </button>
        <span className="eyebrow">THE VERY SHORT RULEBOOK</span>
        <h2>
          A little poker.
          <br />
          <em>A lot of nerve.</em>
        </h2>
        <ol className="rules-list">
          <li>
            <b>Four cards each. One shared pool.</b>
            <p>
              Keep your hand to yourself. Every bid is about the cards in
              everyone’s hands combined. Suits don’t matter.
            </p>
          </li>
          <li>
            <b>Make a bigger claim.</b>
            <p>
              Every bid must beat the last: single → pair → two pair → triple →
              full house → four of a kind. Ranks run from 2 to Ace. Compare two
              pairs by the higher pair, then the lower pair; full houses by
              their triple, then their pair. Pairs, two pair, triples, and four
              of a kind may add one kicker of a different rank. Compare the main
              combination first, then the kicker. A single already stands alone;
              a full house has no kicker.
            </p>
          </li>
          <li>
            <b>Read the room.</b>
            <p>
              Call <strong>Bluff</strong> if the bid doesn’t exist. Call{" "}
              <strong>High Card</strong> if you think it is the highest possible
              combination in the pool. Include the highest available kicker when
              the combination allows one.
            </p>
          </li>
          <li>
            <b>Call it, or protect your own bid.</b>
            <p>
              A correct challenge costs the bidder a card. A wrong challenge
              costs the challenger a card. Everyone sees the hands for 12
              seconds, then a fresh deal starts. The next surviving player after
              the last bidder goes first.
            </p>
            <p>
              Bid + declare High Card to reveal immediately on your own claim.
              If you are right, no one loses a card. If you are wrong, you lose
              one. You can also declare it on your latest bid before another
              move arrives.
            </p>
          </li>
          <li>
            <b>Keep your seat.</b>
            <p>
              Zero cards means you become a spectator. The last player with
              cards wins.
            </p>
          </li>
        </ol>
        <button className="button button-dark button-full" onClick={onClose}>
          Got it. Let’s play.
          <Icon name="arrow" />
        </button>
      </div>
    </dialog>
  );
}
