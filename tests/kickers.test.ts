import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  advanceRoom,
  createRoom,
  joinRoom,
  roomView,
  REVEAL_MS,
} from "../src/lib/game.ts";
import {
  availableBids,
  combinationCards,
  combinationExists,
  combinationLabel,
  compareCombinations,
  highestCombination,
  validCombination,
} from "../src/lib/rules.ts";
import type { Card, Combination } from "../src/lib/rules.ts";
import type { Room } from "../src/lib/game.ts";

const cards = (...ranks: number[]): Card[] =>
  ranks.map((rank, index) => ({
    rank,
    suit: ranks.slice(0, index).filter((other) => other === rank).length,
  }));
function table(): Room {
  let room = createRoom("ABC234", "a", "Alice", 100);
  room = joinRoom(room, "b", "Bob", 100);
  room = joinRoom(room, "c", "Casey", 100);
  for (const player of room.players)
    room = applyAction(room, player.id, { type: "ready" }, 100);
  room.players[0].hand = cards(14, 14, 13, 12);
  room.players[1].hand = cards(2, 3, 4, 5);
  room.players[2].hand = cards(6, 7, 8, 9);
  return room;
}
function claim(room: Room, combination: Combination, highCard = false): Room {
  return applyAction(
    room,
    "a",
    {
      type: "bid",
      combination,
      highCard,
      expectedBidId: room.bid?.id ?? null,
      round: room.round,
    },
    200,
  );
}
function highCard(room: Room, id: string): Room {
  return applyAction(
    room,
    id,
    {
      type: "challenge",
      challenge: "high-card",
      bidId: room.bid!.id,
      round: room.round,
    },
    300,
  );
}

test("one optional, distinct kicker is valid for a pair, triple, or quads", () => {
  for (const kind of ["pair", "triple", "four-kind"] as const) {
    assert.equal(validCombination({ kind, rank: 14, kickerRank: 13 }), true);
    assert.equal(validCombination({ kind, rank: 14, kickerRank: 14 }), false);
    assert.equal(
      validCombination({ kind, rank: 14, kickerRank: [13, 12] }),
      false,
    );
    assert.equal(validCombination({ kind, rank: 14, kickerRank: 15 }), false);
  }
  assert.equal(
    validCombination({ kind: "single", rank: 14, kickerRank: 13 }),
    false,
  );
  assert.equal(
    validCombination({
      kind: "two-pair",
      rank: 14,
      pairRank: 13,
      kickerRank: 12,
    }),
    true,
  );
  assert.equal(
    validCombination({
      kind: "two-pair",
      rank: 14,
      pairRank: 13,
      kickerRank: 13,
    }),
    false,
  );
  assert.equal(
    validCombination({
      kind: "full-house",
      rank: 14,
      pairRank: 12,
      kickerRank: 13,
    }),
    false,
  );
});

test("kickers break ties only after the complete main combination", () => {
  assert.ok(
    compareCombinations(
      { kind: "pair", rank: 14, kickerRank: 2 },
      { kind: "pair", rank: 14 },
    ) > 0,
  );
  assert.ok(
    compareCombinations(
      { kind: "pair", rank: 14, kickerRank: 13 },
      { kind: "pair", rank: 14, kickerRank: 12 },
    ) > 0,
  );
  assert.ok(
    compareCombinations(
      { kind: "pair", rank: 14, kickerRank: 2 },
      { kind: "pair", rank: 13, kickerRank: 14 },
    ) > 0,
  );
  const previous: Combination = { kind: "four-kind", rank: 14 };
  const raises = availableBids(previous);
  assert.deepEqual(raises[0], { ...previous, kickerRank: 2 });
  assert.deepEqual(raises.at(-1), { ...previous, kickerRank: 13 });
  assert.deepEqual(availableBids({ ...previous, kickerRank: 13 }), []);
});

test("a kicker must exist in the pool and appears in the bid cards and caption", () => {
  const combination: Combination = { kind: "triple", rank: 13, kickerRank: 14 };
  assert.equal(combinationExists(combination, cards(13, 13, 13, 12)), false);
  assert.equal(combinationExists(combination, cards(13, 13, 13, 14)), true);
  assert.deepEqual(
    combinationCards(combination).map((card) => card.rank),
    [13, 13, 13, 14],
  );
  assert.equal(combinationLabel(combination), "Three Kings + A");
});

test("the highest allowed combination includes exactly one best kicker when available", () => {
  assert.deepEqual(highestCombination(cards(14, 14, 13, 12, 11)), {
    kind: "pair",
    rank: 14,
    kickerRank: 13,
  });
  assert.deepEqual(highestCombination(cards(14, 14, 13, 13, 12, 11)), {
    kind: "two-pair",
    rank: 14,
    pairRank: 13,
    kickerRank: 12,
  });
  assert.deepEqual(highestCombination(cards(14, 14, 13, 13)), {
    kind: "two-pair",
    rank: 14,
    pairRank: 13,
  });
  assert.deepEqual(highestCombination(cards(13, 13, 13, 14, 12)), {
    kind: "triple",
    rank: 13,
    kickerRank: 14,
  });
  assert.deepEqual(highestCombination(cards(14, 14, 14, 14, 13, 12)), {
    kind: "four-kind",
    rank: 14,
    kickerRank: 13,
  });
  assert.deepEqual(highestCombination(cards(14, 14, 14, 14)), {
    kind: "four-kind",
    rank: 14,
  });
  assert.deepEqual(highestCombination(cards(13, 13, 13)), {
    kind: "triple",
    rank: 13,
  });
  assert.deepEqual(highestCombination(cards(14, 14)), {
    kind: "pair",
    rank: 14,
  });
  assert.deepEqual(highestCombination(cards(13, 13, 13, 12, 12, 14)), {
    kind: "full-house",
    rank: 13,
    pairRank: 12,
  });
});

test("High Card on a bare pair fails if that pair has an available kicker", () => {
  const wrong = highCard(claim(table(), { kind: "pair", rank: 14 }), "b");
  assert.equal(wrong.result!.correct, false);
  assert.equal(wrong.result!.loserId, "b");
  const right = highCard(
    claim(table(), { kind: "pair", rank: 14, kickerRank: 13 }),
    "b",
  );
  assert.equal(right.result!.correct, true);
  assert.equal(right.result!.loserId, "a");
  assert.deepEqual(right.result!.bid, {
    kind: "pair",
    rank: 14,
    kickerRank: 13,
  });
});

test("a correct bid plus self High Card reveals atomically with no penalty, then deals after the bidder", () => {
  const source = table();
  let room = claim(source, { kind: "pair", rank: 14, kickerRank: 13 }, true);
  assert.equal(source.bid, null);
  assert.equal(room.phase, "reveal");
  assert.equal(room.result!.challenge, "self-high-card");
  assert.equal(room.result!.correct, true);
  assert.equal(room.result!.loserId, null);
  assert.deepEqual(
    room.players.map((player) => player.cards),
    [4, 4, 4],
  );
  assert.ok(
    roomView(room, "b").players.every((player) => player.hand !== null),
  );
  assert.equal(roomView(room, "visitor").result, null);
  assert.throws(() => highCard(room, "b"), /active round/);
  room = advanceRoom(room, 200 + REVEAL_MS);
  assert.equal(room.round, 2);
  assert.equal(room.turnPlayerId, "b");
  assert.deepEqual(room.lastBids, {});
  assert.deepEqual(
    room.players.map((player) => player.hand.length),
    [4, 4, 4],
  );
});

test("an incorrect self High Card costs only the bidder one card, including a missing kicker", () => {
  for (const combination of [
    { kind: "pair", rank: 14 },
    { kind: "four-kind", rank: 14, kickerRank: 13 },
  ] as const) {
    const room = claim(table(), combination, true);
    assert.equal(room.result!.correct, false);
    assert.equal(room.result!.loserId, "a");
    assert.deepEqual(
      room.players.map((player) => player.cards),
      [3, 4, 4],
    );
  }
});

test("a raise from three Aces to Aces full of Queens can declare High Card in the same action", () => {
  let room = table();
  room.players[0].hand = cards(14, 14, 14, 12);
  room.players[1].hand = cards(12, 13, 2, 3);
  room.players[2].hand = cards(4, 5, 6, 7);
  room = claim(room, { kind: "triple", rank: 14 });
  room = applyAction(
    room,
    "b",
    {
      type: "bid",
      combination: { kind: "full-house", rank: 14, pairRank: 12 },
      highCard: true,
      expectedBidId: room.bid!.id,
      round: 1,
    },
    250,
  );
  assert.equal(room.result!.correct, true);
  assert.equal(room.result!.loserId, null);
  assert.equal(room.result!.bidderId, "b");
  assert.deepEqual(
    room.players.map((player) => player.cards),
    [4, 4, 4],
  );
  assert.equal(advanceRoom(room, 250 + REVEAL_MS).turnPlayerId, "c");
});

test("the owner may declare High Card on their current bid, but cannot call their own Bluff", () => {
  const room = claim(table(), { kind: "pair", rank: 14, kickerRank: 13 });
  assert.equal(highCard(room, "a").result!.loserId, null);
  assert.throws(
    () =>
      applyAction(room, "a", {
        type: "challenge",
        challenge: "bluff",
        bidId: room.bid!.id,
        round: 1,
      }),
    /own bid/,
  );
});

test("an incorrect self High Card can eliminate the bidder and finish a match", () => {
  const room = table();
  room.players[0].cards = 1;
  room.players[0].hand = cards(2);
  room.players[2].cards = 0;
  room.players[2].hand = [];
  const result = claim(room, { kind: "single", rank: 14 }, true);
  assert.equal(result.phase, "finished");
  assert.equal(result.winnerId, "b");
  assert.equal(result.players[0].cards, 0);
});
