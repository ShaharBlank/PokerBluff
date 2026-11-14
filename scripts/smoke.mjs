import assert from "node:assert/strict";
import { highestCombination } from "../src/lib/rules.ts";

const base = process.env.TEST_URL ?? "http://localhost:3000";
function player() {
  let cookie = "";
  return async (path, body, expected = 200, headers = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined
          ? {}
          : { "content-type": "application/json", origin: base }),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const newCookie = response.headers.get("set-cookie");
    if (newCookie) cookie = newCookie.split(";")[0];
    const json = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(json)}`);
    return json;
  };
}
const alice = player(),
  bob = player(),
  casey = player(),
  outsider = player();
const { code } = await alice("/api/rooms", { name: "Smoke Alice" });
const root = `/api/rooms/${code}`;
await bob(`${root}/join`, { name: "Smoke Bob" });
await casey(`${root}/join`, { name: "Smoke Casey" });
await alice(`${root}/action`, { type: "ready" });
await bob(`${root}/action`, { type: "ready" });
const started = await casey(`${root}/action`, { type: "ready" });
assert.equal(started.phase, "playing");
assert.equal(started.players.filter((p) => p.hand !== null).length, 1);
const a = await alice(root),
  b = await bob(root),
  c = await casey(root);
assert.equal(a.players.find((p) => p.id === a.you).hand.length, 4);
assert.equal(a.players.find((p) => p.id === b.you).hand, null);
const guest = await outsider(root);
assert.equal(guest.you, null);
assert.ok(guest.players.every((p) => p.hand === null));
await outsider(`${root}/action`, { type: "ready" }, 403);
await alice(`${root}/action`, { type: "ready" }, 403, {
  origin: "https://unrelated.example",
});
await bob(
  `${root}/action`,
  {
    type: "bid",
    combination: { kind: "single", rank: 2 },
    expectedBidId: null,
    round: 1,
  },
  409,
);
await alice(
  `${root}/action`,
  {
    type: "bid",
    combination: { kind: "pair", rank: 2 },
    highCard: true,
    expectedBidId: null,
    round: 1,
  },
  400,
);
const afterBlockedDeclaration = await alice(root);
assert.equal(afterBlockedDeclaration.version, a.version);
assert.equal(afterBlockedDeclaration.bid, null);
assert.equal(afterBlockedDeclaration.result, null);
const afterBid = await alice(`${root}/action`, {
  type: "bid",
  combination: { kind: "pair", rank: 2 },
  expectedBidId: null,
  round: 1,
});
assert.deepEqual(afterBid.lastBids[a.you].combination, {
  kind: "pair",
  rank: 2,
});
assert.equal((await bob(root)).lastBids[a.you].id, afterBid.bid.id);
for (const client of [alice, bob])
  await client(
    `${root}/action`,
    {
      type: "challenge",
      challenge: "high-card",
      bidId: afterBid.bid.id,
      round: 1,
    },
    400,
  );
const afterBlockedCalls = await alice(root);
assert.equal(afterBlockedCalls.version, afterBid.version);
assert.equal(afterBlockedCalls.phase, "playing");
assert.equal(
  afterBlockedCalls.players.reduce((sum, p) => sum + p.cards, 0),
  12,
);
assert.equal(
  afterBlockedCalls.players.filter((p) => p.hand !== null).length,
  1,
);
await Promise.all(Array.from({ length: 25 }, () => alice(root)));
// Simultaneous challenges must resolve once, with exactly one card removed.
const action = {
  type: "challenge",
  challenge: "bluff",
  bidId: afterBid.bid.id,
  round: 1,
};
const responses = await Promise.allSettled([
  bob(`${root}/action`, action),
  casey(`${root}/action`, action),
]);
assert.equal(
  responses.filter((result) => result.status === "fulfilled").length,
  1,
);
const revealed = await alice(root);
assert.equal(revealed.phase, "reveal");
assert.equal(
  revealed.players.reduce((sum, p) => sum + p.cards, 0),
  11,
);
assert.ok(revealed.players.every((p) => p.hand !== null));
assert.equal((await outsider(root)).result, null);
await alice(`${root}/action`, { type: "continue" });
await bob(`${root}/action`, { type: "continue" });
const next = await casey(`${root}/action`, { type: "continue" });
assert.equal(next.round, 2);
assert.deepEqual(next.lastBids, {});
assert.equal(next.turnPlayerId, b.you);
assert.equal(
  next.players.find((p) => p.id === c.you).hand.length,
  next.players.find((p) => p.id === c.you).cards,
);
// Each test client contributes only its own hand to the integration-test oracle.
const clients = [alice, bob, casey];
async function poolForTest() {
  const views = await Promise.all(clients.map((client) => client(root)));
  return views.flatMap(
    (view) => view.players.find((p) => p.id === view.you).hand,
  );
}
const best = highestCombination(await poolForTest());
const protectedBid = await bob(`${root}/action`, {
  type: "bid",
  combination: best,
  highCard: true,
  expectedBidId: null,
  round: 2,
});
assert.equal(protectedBid.phase, "reveal");
assert.equal(protectedBid.result.challenge, "self-high-card");
assert.equal(protectedBid.result.correct, true);
assert.equal(protectedBid.result.loserId, null);
assert.equal(protectedBid.result.bonusPlayerId, b.you);
assert.equal(
  protectedBid.players.find((p) => p.id === b.you).cards,
  next.players.find((p) => p.id === b.you).cards + 1,
);
assert.equal(
  protectedBid.players.reduce((sum, p) => sum + p.cards, 0),
  12,
);
assert.equal((await alice(root)).result.loserId, null);
await casey(
  `${root}/action`,
  {
    type: "challenge",
    challenge: "high-card",
    bidId: protectedBid.bid.id,
    round: 2,
  },
  409,
);
for (const client of clients)
  await client(`${root}/action`, { type: "continue" });
const third = await casey(root);
assert.equal(third.round, 3);
assert.equal(third.turnPlayerId, c.you);
await casey(
  `${root}/action`,
  {
    type: "bid",
    combination: { kind: "pair", rank: 14, kickerRank: 13 },
    highCard: "yes",
    expectedBidId: null,
    round: 3,
  },
  400,
);
await casey(
  `${root}/action`,
  {
    type: "bid",
    combination: { kind: "pair", rank: 14, kickerRank: 14 },
    expectedBidId: null,
    round: 3,
  },
  400,
);
const pool = await poolForTest();
const missingQuad = Array.from({ length: 12 }, (_, i) => i + 2).find(
  (rank) => pool.filter((card) => card.rank === rank).length < 4,
);
const wrongClaim = { kind: "four-kind", rank: missingQuad, kickerRank: 14 };
const wrongSelf = await casey(`${root}/action`, {
  type: "bid",
  combination: wrongClaim,
  highCard: true,
  expectedBidId: null,
  round: 3,
});
assert.deepEqual(wrongSelf.bid.combination, wrongClaim);
assert.deepEqual(wrongSelf.result.bid, wrongClaim);
assert.equal(wrongSelf.result.correct, false);
assert.equal(wrongSelf.result.loserId, c.you);
assert.equal(
  wrongSelf.players.reduce((sum, p) => sum + p.cards, 0),
  11,
);
assert.equal(wrongSelf.result.bonusPlayerId, null);
for (const client of clients)
  await client(`${root}/action`, { type: "continue" });
const fourth = await alice(root);
assert.equal(fourth.round, 4);
const highestBid = await alice(`${root}/action`, {
  type: "bid",
  combination: highestCombination(await poolForTest()),
  expectedBidId: null,
  round: 4,
});
const highCardCall = {
  type: "challenge",
  challenge: "high-card",
  bidId: highestBid.bid.id,
  round: 4,
};
const competingHighCards = await Promise.allSettled([
  bob(`${root}/action`, highCardCall),
  casey(`${root}/action`, highCardCall),
]);
assert.equal(
  competingHighCards.filter((result) => result.status === "fulfilled").length,
  1,
);
const rewarded = await alice(root);
const rewardedId = rewarded.result.challengerId;
assert.equal(rewarded.result.bonusPlayerId, rewardedId);
assert.equal(
  rewarded.players.find((p) => p.id === rewardedId).cards,
  fourth.players.find((p) => p.id === rewardedId).cards + 1,
);
assert.equal(
  rewarded.players.find((p) => p.id === a.you).cards,
  fourth.players.find((p) => p.id === a.you).cards - 1,
);
assert.equal(
  rewarded.players.reduce((sum, p) => sum + p.cards, 0),
  11,
);
for (const client of clients)
  await client(`${root}/action`, { type: "continue" });
const fifth = await alice(root);
assert.equal(fifth.round, 5);
for (const client of clients) {
  const own = await client(root);
  const player = own.players.find((p) => p.id === own.you);
  assert.equal(player.hand.length, player.cards);
}
await alice(`${root}/action`, { type: "leave" });
await bob(`${root}/action`, { type: "leave" });
await casey(`${root}/action`, { type: "leave" });
console.log(
  "HTTP smoke passed: private sessions, kicker guards, authorization, simultaneous challenges, self and external High Card bonuses, no duplicate rewards, larger next-deal hands, turn order, leaving.",
);
