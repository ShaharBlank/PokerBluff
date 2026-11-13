import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceRoom,
  applyAction,
  cleanName,
  createRoom,
  joinRoom,
  REVEAL_MS,
  roomView,
} from "../src/lib/game.ts";
import type { Room } from "../src/lib/game.ts";
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

const cards = (...ranks: number[]): Card[] =>
  ranks.map((rank, i) => ({
    rank,
    suit: ranks.slice(0, i).filter((other) => other === rank).length,
  }));

test("four Aces are illustrated as four distinct Ace card faces", () => {
  assert.deepEqual(combinationCards({ kind: "four-kind", rank: 14 }), [
    { rank: 14, suit: 0 },
    { rank: 14, suit: 1 },
    { rank: 14, suit: 2 },
    { rank: 14, suit: 3 },
  ]);
});

test("a full house preview contains the triple followed by the selected pair", () => {
  assert.deepEqual(
    combinationCards({ kind: "full-house", rank: 13, pairRank: 8 }),
    [
      { rank: 13, suit: 0 },
      { rank: 13, suit: 1 },
      { rank: 13, suit: 2 },
      { rank: 8, suit: 0 },
      { rank: 8, suit: 1 },
    ],
  );
  for (const [kind, count] of [
    ["single", 1],
    ["pair", 2],
    ["triple", 3],
  ] as const) {
    assert.equal(combinationCards({ kind, rank: 7 }).length, count);
  }
});

test("the latest bid of every player is retained while their own newer bid replaces it", () => {
  let room = bid(fixture(), "a", { kind: "single", rank: 2 });
  room = bid(room, "b", { kind: "pair", rank: 8 });
  room = bid(room, "c", { kind: "triple", rank: 13 });
  room = bid(room, "d", { kind: "full-house", rank: 13, pairRank: 8 });
  room = bid(room, "a", { kind: "four-kind", rank: 3 });
  assert.equal(Object.keys(room.lastBids!).length, 4);
  assert.deepEqual(room.lastBids!.a.combination, {
    kind: "four-kind",
    rank: 3,
  });
  assert.deepEqual(room.lastBids!.b.combination, { kind: "pair", rank: 8 });
  assert.deepEqual(roomView(room, "c").lastBids.d.combination, {
    kind: "full-house",
    rank: 13,
    pairRank: 8,
  });
  assert.deepEqual(roomView(room, "visitor").lastBids, {});
});

test("public bid illustrations clear with the next deal", () => {
  let room = challenge(
    bid(fixture(), "a", { kind: "single", rank: 2 }),
    "d",
    "bluff",
  );
  assert.equal(room.lastBids!.a.combination.rank, 2);
  room = advanceRoom(room, 300 + REVEAL_MS);
  assert.deepEqual(roomView(room, "a").lastBids, {});
});

test("rooms saved before bid history was added still show their current bid and accept new bids", () => {
  let room = bid(fixture(), "a", { kind: "single", rank: 2 });
  delete room.lastBids;
  assert.deepEqual(roomView(room, "b").lastBids.a.combination, {
    kind: "single",
    rank: 2,
  });
  room = bid(room, "b", { kind: "pair", rank: 8 });
  assert.equal(Object.keys(room.lastBids!).length, 2);
  assert.deepEqual(room.lastBids!.a.combination, { kind: "single", rank: 2 });
  assert.deepEqual(room.lastBids!.b.combination, { kind: "pair", rank: 8 });
});
function match(count = 4): Room {
  let room = createRoom("ABC234", "a", "Alice", 100);
  for (let i = 1; i < count; i++)
    room = joinRoom(
      room,
      String.fromCharCode(97 + i),
      ["Alice", "Bob", "Casey", "Drew"][i] ?? `Player ${i}`,
      100,
    );
  for (const player of room.players)
    room = applyAction(room, player.id, { type: "ready" }, 100);
  return room;
}
function fixture(): Room {
  const room = match();
  // Independently specified pool: three Kings, pair of 8s, and all other ranks unique.
  const hands = [
    cards(13, 13, 8, 2),
    cards(13, 8, 3, 4),
    cards(5, 6, 7, 9),
    cards(10, 11, 12, 14),
  ];
  for (const [index, player] of room.players.entries())
    player.hand = hands[index];
  return room;
}
function bid(
  room: Room,
  id: string,
  combination: Combination,
  highCard = false,
): Room {
  return applyAction(
    room,
    id,
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
function challenge(room: Room, id: string, kind: "bluff" | "high-card"): Room {
  return applyAction(
    room,
    id,
    {
      type: "challenge",
      challenge: kind,
      bidId: room.bid!.id,
      round: room.round,
    },
    300,
  );
}

test("a match starts only when at least two players have each pressed Start game", () => {
  let room = createRoom("ABC234", "a", "Alice", 100);
  room = applyAction(room, "a", { type: "ready" }, 100);
  assert.equal(room.phase, "lobby");
  room = joinRoom(room, "b", "Bob", 100);
  assert.equal(room.phase, "lobby");
  room = applyAction(room, "b", { type: "ready" }, 100);
  assert.equal(room.phase, "playing");
  assert.equal(room.turnPlayerId, "a");
  assert.deepEqual(
    room.players.map((player) => player.hand.length),
    [4, 4],
  );
});

test("10 players receive 40 unique cards; an eleventh cannot join", () => {
  const room = match(10);
  const pool = room.players.flatMap((player) => player.hand);
  assert.equal(pool.length, 40);
  assert.equal(
    new Set(pool.map((card) => `${card.rank}:${card.suit}`)).size,
    40,
  );
  const lobby = { ...room, phase: "lobby" as const };
  assert.throws(() => joinRoom(lobby, "extra", "Extra"), /full/);
});

test("combinations rank by category before rank; full houses compare triple then pair", () => {
  assert.ok(
    compareCombinations(
      { kind: "pair", rank: 2 },
      { kind: "single", rank: 14 },
    ) > 0,
  );
  assert.ok(
    compareCombinations(
      { kind: "four-kind", rank: 2 },
      { kind: "full-house", rank: 14, pairRank: 13 },
    ) > 0,
  );
  assert.ok(
    compareCombinations(
      { kind: "full-house", rank: 3, pairRank: 2 },
      { kind: "full-house", rank: 2, pairRank: 14 },
    ) > 0,
  );
  assert.ok(
    compareCombinations(
      { kind: "full-house", rank: 13, pairRank: 9 },
      { kind: "full-house", rank: 13, pairRank: 8 },
    ) > 0,
  );
});

test("suits and unsupported poker hands do not affect the highest combination", () => {
  assert.deepEqual(highestCombination(cards(2, 3, 4, 5, 6)), {
    kind: "single",
    rank: 6,
  });
  assert.deepEqual(highestCombination(cards(14, 14, 13, 13, 2)), {
    kind: "two-pair",
    rank: 14,
    pairRank: 13,
    kickerRank: 2,
  });
  assert.deepEqual(highestCombination(cards(2, 2, 2, 2, 14, 14, 14, 13, 13)), {
    kind: "four-kind",
    rank: 2,
    kickerRank: 14,
  });
  assert.equal(
    combinationExists({ kind: "triple", rank: 13 }, cards(13, 13, 13, 13)),
    true,
  );
});

test("two pair compares both ranks, sits between pair and triple, and needs both pairs", () => {
  const claim: Combination = { kind: "two-pair", rank: 14, pairRank: 12 };
  assert.ok(compareCombinations(claim, { kind: "pair", rank: 14 }) > 0);
  assert.ok(compareCombinations(claim, { kind: "triple", rank: 2 }) < 0);
  assert.ok(compareCombinations(claim, { ...claim, pairRank: 11 }) > 0);
  assert.ok(compareCombinations(claim, { ...claim, rank: 13 }) > 0);
  assert.equal(validCombination({ ...claim, pairRank: 14 }), false);
  assert.equal(validCombination({ ...claim, rank: 11 }), false);
  assert.equal(combinationExists(claim, cards(14, 14, 12)), false);
  assert.equal(combinationExists(claim, cards(14, 14, 12, 12)), true);
  assert.deepEqual(highestCombination(cards(14, 14, 13, 13, 12, 12)), {
    kind: "two-pair",
    rank: 14,
    pairRank: 13,
    kickerRank: 12,
  });
  assert.equal(combinationLabel(claim), "Pairs of Aces and Queens");
  assert.deepEqual(
    combinationCards(claim).map((card) => card.rank),
    [14, 14, 12, 12],
  );
  const raises = availableBids({ kind: "two-pair", rank: 14, pairRank: 12 });
  assert.ok(
    raises.some(
      (choice) => choice.kind === "two-pair" && choice.pairRank === 13,
    ),
  );
  assert.ok(
    raises.every(
      (choice) =>
        validCombination(choice) && compareCombinations(choice, claim) > 0,
    ),
  );
});

test("a full house needs different ranks, and the strongest eligible pair is used", () => {
  assert.equal(
    validCombination({ kind: "full-house", rank: 13, pairRank: 13 }),
    false,
  );
  assert.equal(validCombination({ kind: "pair", rank: 15 }), false);
  assert.equal(
    validCombination({ kind: "pair", rank: 14, pairRank: 13 }),
    false,
  );
  assert.equal(validCombination({ kind: "flush", rank: 14 }), false);
  assert.deepEqual(highestCombination(cards(13, 13, 13, 8, 8, 12, 12)), {
    kind: "full-house",
    rank: 13,
    pairRank: 12,
  });
});

test("a two-pair bid retains both pair ranks and its kicker through storage, views, and a challenge", () => {
  let room = match(3);
  room.players[0].hand = cards(14, 14, 4, 5);
  room.players[1].hand = cards(13, 13, 6, 7);
  room.players[2].hand = cards(2, 3, 8, 9);
  const claim: Combination = {
    kind: "two-pair",
    rank: 14,
    pairRank: 13,
    kickerRank: 9,
  };
  room = bid(room, "a", claim);
  assert.deepEqual(roomView(room, "b").bid!.combination, claim);
  assert.deepEqual(room.lastBids!.a.combination, claim);
  room = challenge(room, "c", "high-card");
  assert.equal(room.result!.correct, true);
  assert.equal(room.result!.loserId, "a");
  assert.deepEqual(room.result!.highest, claim);
  assert.equal(room.players[0].cards, 3);
});

test("the server rejects out-of-turn, equal, lower, and stale bids without changing the source", () => {
  const source = fixture();
  assert.throws(
    () => bid(source, "c", { kind: "pair", rank: 4 }),
    /another player/,
  );
  const room = bid(source, "a", { kind: "pair", rank: 8 });
  assert.throws(() => bid(room, "b", { kind: "pair", rank: 8 }), /must beat/);
  assert.throws(
    () => bid(room, "b", { kind: "single", rank: 14 }),
    /must beat/,
  );
  assert.throws(
    () =>
      applyAction(room, "b", {
        type: "bid",
        combination: { kind: "triple", rank: 2 },
        expectedBidId: null,
        round: 1,
      }),
    /new bid/,
  );
  assert.equal(source.bid, null);
  assert.equal(source.turnPlayerId, "a");
});

test("a correct out-of-turn Bluff challenge costs the bidder one card", () => {
  const room = challenge(
    bid(fixture(), "a", { kind: "four-kind", rank: 14 }),
    "d",
    "bluff",
  );
  assert.equal(room.phase, "reveal");
  assert.equal(room.result!.correct, true);
  assert.equal(room.result!.loserId, "a");
  assert.equal(room.players[0].cards, 3);
  assert.equal(room.players[3].cards, 4);
});

test("an incorrect Bluff challenge costs the challenger one card", () => {
  const room = challenge(
    bid(fixture(), "a", { kind: "triple", rank: 13 }),
    "c",
    "bluff",
  );
  assert.equal(room.result!.correct, false);
  assert.equal(room.result!.loserId, "c");
  assert.equal(room.players[2].cards, 3);
});

test("High Card requires the exact highest combination, not merely an existing bid", () => {
  const wrong = challenge(
    bid(fixture(), "a", { kind: "triple", rank: 13 }),
    "d",
    "high-card",
  );
  assert.equal(wrong.result!.exists, true);
  assert.equal(wrong.result!.correct, false);
  assert.equal(wrong.result!.loserId, "d");
  const right = challenge(
    bid(fixture(), "a", { kind: "full-house", rank: 13, pairRank: 8 }),
    "d",
    "high-card",
  );
  assert.equal(right.result!.correct, true);
  assert.equal(right.result!.loserId, "a");
  const absent = challenge(
    bid(fixture(), "a", { kind: "four-kind", rank: 14 }),
    "d",
    "high-card",
  );
  assert.equal(absent.result!.correct, false);
});

test("the next round starts after the last bidder, even when another player challenges", () => {
  let room = bid(fixture(), "a", { kind: "single", rank: 2 });
  room = bid(room, "b", { kind: "pair", rank: 8 });
  room = challenge(room, "d", "bluff");
  assert.equal(advanceRoom(room, 300 + REVEAL_MS - 1), room);
  const next = advanceRoom(room, 300 + REVEAL_MS);
  assert.equal(next.turnPlayerId, "c");
  assert.equal(next.round, 2);
  assert.deepEqual(
    next.players.map((player) => player.hand.length),
    [4, 4, 4, 3],
  );
  assert.equal(next.result, null);
  assert.equal(next.bid, null);
});

test("eliminated players become spectators, cannot act, and are skipped in turn order", () => {
  let room = fixture();
  room.players[2].cards = 1;
  room.players[2].hand = cards(5);
  room = bid(room, "a", { kind: "single", rank: 2 });
  room = bid(room, "b", { kind: "pair", rank: 8 });
  room = challenge(room, "c", "bluff");
  assert.equal(room.players[2].cards, 0);
  assert.throws(() => applyAction(room, "c", { type: "continue" }), /watching/);
  room = advanceRoom(room, 300 + REVEAL_MS);
  assert.equal(room.turnPlayerId, "d");
  assert.deepEqual(room.players[2].hand, []);
  assert.throws(
    () => bid(room, "c", { kind: "single", rank: 2 }),
    /active round/,
  );
});

test("everyone continuing advances early; old challenges cannot resolve twice", () => {
  let room = challenge(
    bid(fixture(), "a", { kind: "pair", rank: 8 }),
    "d",
    "bluff",
  );
  const stale = {
    type: "challenge" as const,
    challenge: "bluff" as const,
    bidId: room.bid!.id,
    round: room.round,
  };
  assert.throws(() => applyAction(room, "c", stale, 400), /active round/);
  for (const player of room.players)
    room = applyAction(room, player.id, { type: "continue" }, 400);
  assert.equal(room.phase, "playing");
  assert.equal(room.round, 2);
  assert.throws(() => applyAction(room, "b", stale, 500), /round has ended/);
});

test("private hands are only visible to their owner until the reveal, including to spectators", () => {
  const room = fixture();
  room.players[2].cards = 0;
  room.players[2].hand = [];
  const own = roomView(room, "a");
  assert.equal(own.players[0].hand!.length, 4);
  assert.equal(own.players[1].hand, null);
  assert.equal(own.result, null);
  const spectator = roomView(room, "c");
  assert.equal(spectator.players[0].hand, null);
  const stranger = roomView(room, "stranger");
  assert.equal(stranger.you, null);
  assert.equal(
    stranger.players.every((player) => player.hand === null),
    true,
  );
  assert.deepEqual(stranger.events, []);
  const revealed = roomView(
    challenge(bid(room, "a", { kind: "pair", rank: 8 }), "d", "bluff"),
    "c",
  );
  assert.equal(revealed.players[0].hand!.length, 4);
  assert.equal(revealed.result!.hands.length, 3);
});

test("the final survivor wins; a unanimous rematch restores four cards to every seated player", () => {
  let room = match(2);
  room.players[0].cards = 1;
  room.players[0].hand = cards(2);
  room.players[1].hand = cards(3, 4, 5, 6);
  room = challenge(
    bid(room, "a", { kind: "four-kind", rank: 14 }),
    "b",
    "bluff",
  );
  assert.equal(room.phase, "finished");
  assert.equal(room.winnerId, "b");
  room = applyAction(room, "a", { type: "rematch" });
  assert.equal(room.phase, "finished");
  room = applyAction(room, "b", { type: "rematch" });
  assert.equal(room.phase, "playing");
  assert.equal(room.round, 1);
  assert.deepEqual(
    room.players.map((player) => player.cards),
    [4, 4],
  );
});

test("leaving during bidding ends the deal, while reconnecting retains the same seat", () => {
  let room = fixture();
  assert.equal(joinRoom(room, "b", "Bob"), room);
  room = applyAction(room, "b", { type: "leave" }, 400);
  assert.equal(room.phase, "reveal");
  assert.equal(room.result!.challenge, "departure");
  assert.equal(room.players[1].cards, 0);
  assert.equal(room.result!.hands[1].cards.length, 4);
  room = advanceRoom(room, 400 + REVEAL_MS);
  assert.deepEqual(room.players[1].hand, []);
});

test("names reject hidden controls and ambiguous duplicate seats", () => {
  assert.equal(cleanName("  Alice  Smith  "), "Alice Smith");
  assert.throws(() => cleanName("A\u202eB"), /visible/);
  assert.throws(() => cleanName("a"), /2–20/);
  assert.throws(
    () => joinRoom(createRoom("ABC234", "a", "Alice"), "b", "alice"),
    /already has/,
  );
});

test("a full 10-player match can finish and every subsequent deal respects the remaining allowance", () => {
  let room = match(10);
  let now = 1000;
  for (let rounds = 0; room.phase !== "finished" && rounds < 52; rounds++) {
    const current = room.turnPlayerId!;
    const highest = highestCombination(
      room.players.flatMap((player) => player.hand),
    )!;
    room = bid(room, current, highest);
    const challenger = room.players.find(
      (player) => !player.left && player.cards > 0 && player.id !== current,
    )!;
    room = challenge(room, challenger.id, "high-card");
    if (room.phase !== "finished") {
      now += REVEAL_MS;
      room = advanceRoom(room, now);
      for (const player of room.players)
        assert.equal(player.hand.length, player.cards);
      const pool = room.players.flatMap((player) => player.hand);
      assert.equal(
        new Set(pool.map((card) => `${card.rank}:${card.suit}`)).size,
        pool.length,
      );
    }
  }
  assert.equal(room.phase, "finished");
  assert.equal(room.players.filter((player) => player.cards > 0).length, 1);
  assert.ok(room.winnerId);
});
