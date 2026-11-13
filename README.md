# BLUFF

A lightweight multiplayer card game for friends. Next.js, React, TypeScript, CSS animations, and server-controlled game state. Deploys to Vercel with Upstash Redis.

## Run locally

Requires Node.js 22.14 or later.

```sh
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000). Create a table, share its invite link, and have everyone press **Start game**. Use separate browser profiles or different devices to play as different people; tabs in the same browser share a seat.

Local development works without accounts or external services. It saves rooms in the ignored `.local-data/` directory. For another device on your network, open the site using this computer's LAN address, and create/share the invite link from that address.

## Deploy to Vercel

1. Push this project to a Git repository and import it in Vercel, or run `npx vercel login` followed by `npx vercel` from this directory. Vercel detects Next.js automatically. The initial deployment can render the site before storage is connected.
2. In the Vercel project, add **Upstash Redis** from the [Vercel Marketplace](https://vercel.com/docs/marketplace-storage). Connect the database to this project for Production (and Preview if needed).
3. Confirm the project has these **server-only** environment variables:

   ```text
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   ```

   The integration's `KV_REST_API_URL` / `KV_REST_API_TOKEN` names are also supported. If you choose a custom prefix, map its variables to the names above. Do not prefix the token with `NEXT_PUBLIC_`.

4. Redeploy after connecting storage. With the CLI, run `npx vercel --prod`. Share the production URL with your friends.

Production requires Redis: the app deliberately refuses to create games with local or in-memory storage in production. This keeps rooms consistent across Vercel instances. No separate always-running server or WebSocket host is required.

See the official [Upstash integration guide](https://upstash.com/docs/redis/howto/vercelintegration) and [Vercel CLI deployment guide](https://vercel.com/docs/cli/deploy).

## Confirmed game rules

- One standard 52-card deck, no jokers. Supports 2–13 players; everyone begins with four cards.
- All hands form a shared pool. Suits do not affect bids. Cards stay fixed while bids go around the table.
- Every bid must increase: **single < pair < triple < full house < four of a kind**. Ranks run from 2 to Ace. Full houses compare the triple first, then the pair.
- A bid means _at least_ that combination exists. Four Kings therefore satisfy a claim of three Kings. Two pair, straights, and flushes are not separate combinations.
- Any other active player can challenge the latest bid, even outside their turn. **Bluff** claims the combination does not exist. **High Card** claims it is the exact highest permitted combination in the whole pool.
- A correct challenge costs the bidder one card. An incorrect challenge costs the challenger one card.
- Everyone sees the hands and the actual highest combination after a challenge. The next deal begins after 12 seconds, or when every surviving player presses **Next round**.
- The next surviving player after the last bidder starts the next round. The deck is shuffled again and everyone receives their remaining allowance.
- A player with zero cards stays as a spectator. Spectators see hidden hands during bidding and all hands at the reveal. The last player with cards wins.
- A rematch starts when every seated player, including eliminated players, presses **Play again**.

## Connection and privacy behavior

- Guests choose nicknames; no registration is required. A random, HTTP-only cookie retains their seat when they reload or reconnect from the same browser.
- Refreshing or briefly losing connectivity does not deduct cards. There is no turn clock; a disconnected player keeps their seat until they return. Use **Leave table** before departing a match: it forfeits all remaining cards and ends the current deal so the pool cannot silently change during bidding.
- Room state is fetched approximately every 1.2 seconds during bidding, 2.2 seconds in the lobby/reveal, and 5 seconds in background tabs. Moves update the acting player's view immediately after the server responds.
- Opponents' hands are excluded from responses until the reveal. Redis credentials and shuffled decks stay on the server.
- Atomic version checks settle competing actions once. A stale bid or challenge receives a conflict response and the client refreshes its view.
- Room records expire 24 hours after the last move. Names and game state are stored only in their room. There is no money, account system, chat, or leaderboard.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

With the dev server running:

```sh
node scripts/smoke.mjs
```

The rule tests cover ranking, challenge outcomes, turn order, private hands, readiness, elimination, a complete 13-player match, and rematches. The HTTP smoke check uses independent cookie sessions and concurrent challenges, checks authorization and cross-origin rejection, and exercises the full ready/deal/bid/reveal/redeal flow. It creates disposable local test rooms.

Desktop and 390px mobile layouts were also checked in a browser, including the lobby, bidding, reveal, and next round. Reduced-motion preferences disable animations.

## Project map

- `src/lib/rules.ts`: shared combination ranking and bid options.
- `src/lib/game.ts`: dealing, lobby/match transitions, challenges, and private player views.
- `src/lib/store.ts`: Redis persistence with atomic writes; local development persistence.
- `src/lib/server.ts` and `src/app/api/rooms/`: guest sessions, validation, and HTTP routes.
- `src/components/game-room.tsx`: lobby, table, bid controls, spectators, and reveal.
- `GLOSSARY.md`: shared game vocabulary.

The implementation follows the requested [Ponytail](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md) guidance and Matt Pocock's [domain-modeling](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md) and [codebase-design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md) skills. These were read from their public sources; no global skills or plugins were installed.
