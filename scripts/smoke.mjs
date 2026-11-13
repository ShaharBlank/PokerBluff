import assert from "node:assert/strict";

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
const afterBid = await alice(`${root}/action`, {
  type: "bid",
  combination: { kind: "single", rank: 2 },
  expectedBidId: null,
  round: 1,
});
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
assert.equal(next.turnPlayerId, b.you);
assert.equal(
  next.players.find((p) => p.id === c.you).hand.length,
  next.players.find((p) => p.id === c.you).cards,
);
await alice(`${root}/action`, { type: "leave" });
await bob(`${root}/action`, { type: "leave" });
await casey(`${root}/action`, { type: "leave" });
console.log(
  "HTTP smoke passed: independent sessions, readiness, private hands, authorization, simultaneous challenges, redeal, turn order, leaving.",
);
