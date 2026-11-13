import type { CSSProperties } from "react";

export function Avatar({
  name,
  index = 0,
  small = false,
}: {
  name: string;
  index?: number;
  small?: boolean;
}) {
  const colors = [
    "#d8e6ac",
    "#edc5a8",
    "#c5d2e5",
    "#d8c4dd",
    "#e8db9d",
    "#a9d3be",
    "#e1b8ba",
  ];
  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={
        { "--avatar-color": colors[index % colors.length] } as CSSProperties
      }
      aria-hidden="true"
    >
      {name
        .split(/\s+/)
        .map((part) => Array.from(part)[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
