import type { CSSProperties } from "react";

const suits = ["♠", "♥", "♣", "♦"];

export function PlayingCard({
  rank,
  suit = 0,
  hidden = false,
  small = false,
  style,
  className = "",
}: {
  rank?: number;
  suit?: number;
  hidden?: boolean;
  small?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const label =
    rank === 14
      ? "A"
      : rank === 13
        ? "K"
        : rank === 12
          ? "Q"
          : rank === 11
            ? "J"
            : String(rank ?? "A");
  return (
    <div
      style={style}
      className={`playing-card ${hidden ? "card-back" : ""} ${small ? "card-small" : ""} ${suit % 2 ? "card-red" : ""} ${className}`}
      aria-label={
        hidden
          ? "Hidden card"
          : `${label} ${["of spades", "of hearts", "of clubs", "of diamonds"][suit]}`
      }
    >
      {hidden ? (
        <div className="card-back-pattern">
          <span>✳</span>
        </div>
      ) : (
        <>
          <span className="card-corner">
            <b>{label}</b>
            <span>{suits[suit]}</span>
          </span>
          <span className="card-suit">{suits[suit]}</span>
          <span className="card-corner card-corner-bottom">
            <b>{label}</b>
            <span>{suits[suit]}</span>
          </span>
        </>
      )}
    </div>
  );
}
