import { randomInt } from "node:crypto";
import {
  combinationExists,
  combinationLabel,
  compareCombinations,
  DECK_SIZE,
  highestCombination,
  MAX_PLAYERS,
  requiresHighCardKicker,
  validCombination,
} from "./rules.ts";
import type { Card, Combination } from "./rules.ts";

export { MAX_PLAYERS } from "./rules.ts";
export const REVEAL_MS = 12_000;
export type Phase = "lobby" | "playing" | "reveal" | "finished";
export type Player = {
  id: string;
  name: string;
  cards: number;
  hand: Card[];
  ready: boolean;
  left: boolean;
};
export type Bid = { id: string; playerId: string; combination: Combination };
export type GameEvent = {
  id: string;
  text: string;
  tone: "normal" | "bid" | "challenge";
  at: number;
};
export type RoundResult = {
  challenge: "bluff" | "high-card" | "self-high-card" | "departure";
  challengerId: string | null;
  bidderId: string | null;
  bid: Combination | null;
  highest: Combination | null;
  exists: boolean;
  correct: boolean;
  loserId: string | null;
  bonusPlayerId?: string | null;
  bonusSkipped?: boolean;
  hands: { id: string; name: string; cards: Card[] }[];
  nextRoundAt: number;
};
export type Room = {
  code: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  phase: Phase;
  round: number;
  players: Player[];
  turnPlayerId: string | null;
  bid: Bid | null;
  lastBids?: Record<string, Bid>;
  events: GameEvent[];
  result: RoundResult | null;
  winnerId: string | null;
};
export type RoomView = Omit<Room, "players" | "lastBids"> & {
  lastBids: Record<string, Bid>;
  you: string | null;
  serverTime: number;
  players: (Omit<Player, "hand"> & { hand: Card[] | null })[];
};
export type Action =
  | { type: "ready" }
  | { type: "continue" }
  | { type: "rematch" }
  | { type: "leave" }
  | {
      type: "bid";
      combination: Combination;
      highCard?: boolean;
      expectedBidId: string | null;
      round: number;
    }
  | {
      type: "challenge";
      challenge: "bluff" | "high-card";
      bidId: string;
      round: number;
    };

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GameError";
    this.status = status;
  }
}

export function cleanName(value: unknown): string {
  if (typeof value !== "string")
    throw new GameError("Choose a table name first.");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 20 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new GameError("Your name needs 2–20 visible characters.");
  return name;
}

function log(room: Room, text: string, tone: GameEvent["tone"], now: number) {
  room.events.push({
    id: `${room.round}-${room.version}-${room.events.length}-${now}`,
    text,
    tone,
    at: now,
  });
  room.events = room.events.slice(-35);
}

export function createRoom(
  code: string,
  id: string,
  rawName: unknown,
  now = Date.now(),
): Room {
  const name = cleanName(rawName);
  const room: Room = {
    code,
    version: 0,
    createdAt: now,
    updatedAt: now,
    phase: "lobby",
    round: 0,
    players: [{ id, name, cards: 4, hand: [], ready: false, left: false }],
    turnPlayerId: null,
    bid: null,
    lastBids: {},
    events: [],
    result: null,
    winnerId: null,
  };
  log(room, `${name} opened the table.`, "normal", now);
  return room;
}

export function joinRoom(
  source: Room,
  id: string,
  rawName: unknown,
  now = Date.now(),
): Room {
  const name = cleanName(rawName);
  const existing = source.players.find((player) => player.id === id);
  if (existing && !existing.left) return source;
  if (source.phase !== "lobby")
    throw new GameError(
      "This match has already started. You can rejoin from your original browser.",
      409,
    );
  if (source.players.filter((player) => !player.left).length >= MAX_PLAYERS)
    throw new GameError("This table is full.", 409);
  if (
    source.players.some(
      (player) =>
        !player.left && player.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new GameError("Someone at this table already has that name.", 409);
  const room = structuredClone(source);
  room.players = room.players.filter((player) => player.id !== id);
  room.players.push({
    id,
    name,
    cards: 4,
    hand: [],
    ready: false,
    left: false,
  });
  room.version++;
  room.updatedAt = now;
  log(room, `${name} pulled up a chair.`, "normal", now);
  return room;
}

function activePlayers(room: Room) {
  return room.players.filter((player) => !player.left && player.cards > 0);
}

function nextPlayer(room: Room, after: string): string | null {
  const index = room.players.findIndex((player) => player.id === after);
  for (let step = 1; step <= room.players.length; step++) {
    const player = room.players[(index + step) % room.players.length];
    if (!player.left && player.cards > 0) return player.id;
  }
  return null;
}

function deal(room: Room, now: number) {
  const deck: Card[] = Array.from({ length: DECK_SIZE }, (_, i) => ({
    rank: (i % 13) + 2,
    suit: Math.floor(i / 13),
  }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  for (const player of room.players) {
    player.ready = false;
    player.hand = player.left ? [] : deck.splice(0, player.cards);
  }
  room.phase = "playing";
  room.round++;
  room.bid = null;
  room.lastBids = {};
  room.result = null;
  log(room, `Round ${room.round}. Fresh cards, fresh stories.`, "normal", now);
}

function beginMatch(room: Room, now: number) {
  for (const player of room.players) {
    player.cards = player.left ? 0 : 4;
    player.ready = false;
  }
  room.round = 0;
  room.winnerId = null;
  room.events = [];
  room.turnPlayerId = activePlayers(room)[0]?.id ?? null;
  deal(room, now);
}

function continueRound(room: Room, now: number) {
  const after = room.result?.bidderId;
  if (after) room.turnPlayerId = nextPlayer(room, after);
  else if (
    !room.players.some(
      (player) =>
        player.id === room.turnPlayerId && player.cards > 0 && !player.left,
    )
  )
    room.turnPlayerId = nextPlayer(room, room.turnPlayerId ?? "");
  deal(room, now);
}

function finishIfWon(room: Room, now: number): boolean {
  const active = activePlayers(room);
  if (active.length > 1) return false;
  room.phase = "finished";
  room.winnerId = active[0]?.id ?? null;
  room.turnPlayerId = null;
  for (const player of room.players) player.ready = false;
  log(
    room,
    active[0]
      ? `${active[0].name} is the last one standing.`
      : "The table is empty.",
    "challenge",
    now,
  );
  return true;
}

export function advanceRoom(source: Room, now = Date.now()): Room {
  if (
    source.phase !== "reveal" ||
    !source.result ||
    now < source.result.nextRoundAt
  )
    return source;
  const room = structuredClone(source);
  continueRound(room, now);
  room.version++;
  room.updatedAt = now;
  return room;
}

function resolveChallenge(
  room: Room,
  id: string,
  challenge: "bluff" | "high-card" | "self-high-card",
  now: number,
) {
  const bid = room.bid!;
  const player = room.players.find((candidate) => candidate.id === id)!;
  const cards = room.players.flatMap((candidate) => candidate.hand);
  if (
    challenge !== "bluff" &&
    requiresHighCardKicker(bid.combination, cards.length)
  )
    throw new GameError(
      "High Card needs a kicker when extra cards are in the pool.",
    );
  const highest = highestCombination(cards);
  const exists = combinationExists(bid.combination, cards);
  const correct =
    challenge === "bluff"
      ? !exists
      : highest !== null && compareCombinations(highest, bid.combination) === 0;
  const loserId =
    challenge === "self-high-card"
      ? correct
        ? null
        : id
      : correct
        ? bid.playerId
        : id;
  const loser = room.players.find((candidate) => candidate.id === loserId);
  const correctHighCard = correct && challenge !== "bluff";
  const bonusPlayerId = correctHighCard && cards.length < DECK_SIZE ? id : null;
  const bonusSkipped = correctHighCard && bonusPlayerId === null;
  room.result = {
    challenge,
    challengerId: id,
    bidderId: bid.playerId,
    bid: bid.combination,
    highest,
    exists,
    correct,
    loserId,
    bonusPlayerId,
    bonusSkipped,
    hands: room.players
      .filter((candidate) => candidate.hand.length)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        cards: candidate.hand,
      })),
    nextRoundAt: now + REVEAL_MS,
  };
  if (loser) loser.cards--;
  if (bonusPlayerId) player.cards++;
  room.phase = "reveal";
  for (const candidate of room.players) candidate.ready = false;
  const penalty = loser
    ? `${loser.name} loses a card${loser.cards === 0 ? " and becomes a spectator" : ""}.`
    : "No one loses a card.";
  const bonus = bonusPlayerId
    ? ` ${player.name} gains a card for the next deal.`
    : bonusSkipped
      ? " All 52 cards were in play, so no bonus card is added."
      : "";
  log(
    room,
    `${player.name} ${challenge === "self-high-card" ? "declared High Card on their own bid" : `called ${challenge === "bluff" ? "Bluff" : "High Card"}`}. ${correct ? "Good read!" : "Wrong read."} ${penalty}${bonus}`,
    "challenge",
    now,
  );
  finishIfWon(room, now);
}

export function applyAction(
  source: Room,
  id: string,
  action: Action,
  now = Date.now(),
): Room {
  const room = structuredClone(source);
  const player = room.players.find(
    (candidate) => candidate.id === id && !candidate.left,
  );
  if (!player) throw new GameError("Take a seat at this table first.", 403);

  if (action.type === "leave") {
    if (room.phase === "lobby")
      room.players = room.players.filter((candidate) => candidate.id !== id);
    else {
      if (room.phase === "playing" && player.cards > 0) {
        const cards = room.players.flatMap((candidate) => candidate.hand);
        room.result = {
          challenge: "departure",
          challengerId: null,
          bidderId: room.bid?.playerId ?? null,
          bid: room.bid?.combination ?? null,
          highest: highestCombination(cards),
          exists: false,
          correct: false,
          loserId: id,
          hands: room.players
            .filter((candidate) => candidate.hand.length)
            .map((candidate) => ({
              id: candidate.id,
              name: candidate.name,
              cards: candidate.hand,
            })),
          nextRoundAt: now + REVEAL_MS,
        };
        room.phase = "reveal";
        for (const candidate of room.players) candidate.ready = false;
      }
      player.left = true;
      player.cards = 0;
      if (room.phase === "reveal") finishIfWon(room, now);
    }
    log(room, `${player.name} left the table.`, "normal", now);
  } else if (action.type === "ready" || action.type === "rematch") {
    if (room.phase !== (action.type === "ready" ? "lobby" : "finished"))
      throw new GameError("The match has already moved on.", 409);
    player.ready = !player.ready;
    const seated = room.players.filter((candidate) => !candidate.left);
    if (seated.length >= 2 && seated.every((candidate) => candidate.ready))
      beginMatch(room, now);
  } else if (action.type === "continue") {
    if (room.phase !== "reveal")
      throw new GameError("The next round has already started.", 409);
    if (!player.cards) throw new GameError("You’re watching this match.", 403);
    player.ready = true;
    if (activePlayers(room).every((candidate) => candidate.ready))
      continueRound(room, now);
  } else {
    if (room.phase !== "playing" || !player.cards)
      throw new GameError("Wait for an active round to play.", 409);
    if (action.round !== room.round)
      throw new GameError("That round has ended. Your table is updating.", 409);
    if (action.type === "bid") {
      if (room.turnPlayerId !== id)
        throw new GameError("It’s another player’s turn.", 409);
      if ((room.bid?.id ?? null) !== action.expectedBidId)
        throw new GameError(
          "A new bid just arrived. Check the table and try again.",
          409,
        );
      if (!validCombination(action.combination))
        throw new GameError("Choose a valid combination.");
      const combination: Combination = {
        kind: action.combination.kind,
        rank: action.combination.rank,
        ...(action.combination.kind === "full-house" ||
        action.combination.kind === "two-pair"
          ? { pairRank: action.combination.pairRank }
          : {}),
        ...(action.combination.kickerRank !== undefined
          ? { kickerRank: action.combination.kickerRank }
          : {}),
      };
      if (
        room.bid &&
        compareCombinations(combination, room.bid.combination) <= 0
      )
        throw new GameError("Your bid must beat the current bid.");
      room.lastBids ??= room.bid ? { [room.bid.playerId]: room.bid } : {};
      room.bid = {
        id: `${room.round}-${room.version + 1}`,
        playerId: id,
        combination,
      };
      room.lastBids[id] = room.bid;
      room.turnPlayerId = nextPlayer(room, id);
      log(
        room,
        `${player.name} bid ${combinationLabel(combination)}.`,
        "bid",
        now,
      );
      if (action.highCard) resolveChallenge(room, id, "self-high-card", now);
    } else {
      if (!room.bid || room.bid.id !== action.bidId)
        throw new GameError(
          "That bid has changed or was already challenged.",
          409,
        );
      if (room.bid.playerId === id && action.challenge !== "high-card")
        throw new GameError("You can’t call Bluff on your own bid.");
      if (action.challenge !== "bluff" && action.challenge !== "high-card")
        throw new GameError("Choose Bluff or High Card.");
      resolveChallenge(
        room,
        id,
        room.bid.playerId === id ? "self-high-card" : action.challenge,
        now,
      );
    }
  }
  room.version++;
  room.updatedAt = now;
  return room;
}

export function roomView(
  room: Room,
  id: string | null,
  now = Date.now(),
): RoomView {
  const seated = room.players.some(
    (player) => player.id === id && !player.left,
  );
  if (!seated) {
    return {
      code: room.code,
      version: room.version,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      phase: room.phase,
      round: room.round,
      players: room.players
        .filter((player) => !player.left)
        .map((player) => ({
          id: player.id,
          name: player.name,
          cards: player.cards,
          ready: player.ready,
          left: false,
          hand: null,
        })),
      turnPlayerId: null,
      bid: null,
      lastBids: {},
      events: [],
      result: null,
      winnerId: null,
      you: null,
      serverTime: now,
    };
  }
  return {
    ...room,
    lastBids:
      room.lastBids ?? (room.bid ? { [room.bid.playerId]: room.bid } : {}),
    you: id,
    serverTime: now,
    players: room.players.map((player) => ({
      ...player,
      hand:
        room.phase === "reveal" || room.phase === "finished" || player.id === id
          ? player.hand
          : null,
    })),
  };
}
