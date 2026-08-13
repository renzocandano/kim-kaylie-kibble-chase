# Kim & Kaylie: Kibble Chase

A 2D, 8-bit-style, Pac-Man-inspired multiplayer game starring two real cats, Kim and
Kaylie. Two cats race around a maze eating kibble; when they touch, whoever has eaten
more wins and the loser vanishes for 5 seconds before respawning. Most kibble eaten
when the board is cleared wins the match.

**Play it live:** https://kim-kaylie-kibble-chase.pages.dev

## Project layout

- `client/` - the game itself (Phaser 3 + Vite), deployed to Cloudflare Pages.
- `server/` - the multiplayer room logic, a Cloudflare Worker + Durable Object
  (`worker.js`), deployed with Wrangler. One Durable Object instance = one room/match.
- `shared/gameConfig.js` - constants both client and server read from, so gameplay
  numbers (speed, respawn time, etc.) never drift out of sync between them.
- `shared/maps.js` - the canonical runtime copy of map data (walls, kibble tiles,
  spawn points), imported by both client and server so they always agree on layout.
- `maps/` - source/design copies of the maze layouts (1 of 5 built so far, see
  `maps/README.md`). `shared/maps.js` is the one actually loaded by the game.
- `.github/workflows/deploy.yml` - auto-deploys both client and server on every
  push to `main` (see "Deploying / making changes" below).

## Why this isn't PartyKit

The server was originally built on PartyKit, but PartyKit's hosted deploy paths
(both their managed platform and their "deploy to your own Cloudflare account"
beta) hit unresolved platform bugs - a shared-infrastructure custom domain limit
on their managed platform, and a Durable Objects migration bug in their beta
cloud-prem mode. The server was rewritten as a plain Cloudflare Worker + Durable
Object using Wrangler (Cloudflare's own official tool) instead, which sidesteps
both issues and has no cold-start delay on the free tier.

## Design parameters (current)

- Move speed: 4 tiles/sec for both cats, always equal.
- Disappear-on-loss time: 5 seconds.
- Countdown: 3-2-1 after both players are ready.
- Target average match length: ~2 minutes (tuned via each map's kibble count,
  currently ~130-170 open tiles per map - see `shared/gameConfig.js` for the reasoning).
- A match ends when either all kibble is eaten, or a player disconnects/refreshes
  mid-match (the remaining player wins by default). Either way, the room resets to
  a fresh board ~3 seconds later so a new match can start on the same link.
- Only two players can ever be active in a room - a third connection is rejected
  with a "room full" message, so nobody can accidentally double up as the same cat.

## Status: playable and live

Server logic (kibble eating, collisions, respawn, countdown, win condition, and
the disconnect/reset behavior above) has been verified with a scripted test
harness, not just syntax-checked.

Known limitations / not built yet:
- Movement is arrow-keys only (no WASD) - fine for two people on separate devices,
  but no local same-keyboard testing option yet.
- Only one map exists (`map1`, "The Living Room"); no random map selection yet.
- Placeholder colored-square sprites, not real Kim/Kaylie art.
- No bot mode yet (1v1 human only).
- No shareable match-link generator - players share a `?room=` URL manually.
- Equal scores on a collision currently result in no elimination (a design choice
  worth revisiting after more playtesting).

## Deploying / making changes

Every push to `main` on GitHub automatically deploys both the server (Worker) and
client (Pages) via GitHub Actions - no local terminal needed for routine updates.
The workflow needs two repo secrets set under Settings -> Secrets and variables ->
Actions: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

To deploy manually from your own machine instead (e.g. for local testing before
pushing):

```
cd server
npm install
$env:CLOUDFLARE_ACCOUNT_ID="<your account id>"
$env:CLOUDFLARE_API_TOKEN="<your api token>"
npx wrangler deploy
```

```
cd client
npm install
npm run build
npx wrangler pages deploy dist --project-name=kim-kaylie-kibble-chase
```

## Running locally (dev servers, no deploy)

```
cd server && npm install && npx wrangler dev
```
```
cd client && npm install && npm run dev
```

Vite defaults to pointing at `localhost:8787` (Wrangler's dev server port) via
`VITE_SERVER_HOST` - override in a `client/.env` file if needed.

## Next steps

1. **Bot mode** - fully client-side (no server needed): simple AI that paths toward
   the nearest kibble and avoids the opponent unless it's currently winning.
2. **Map selection** - random map chosen per match from the 5 available; build the
   remaining 4 maps (map2-5) once map1's pacing feels right from playtesting.
3. **Real sprites** - replace the placeholder colored squares with 8-bit pixel-art
   sprites of Kim and Kaylie (from the reference photos), plus simple walk-cycle
   animations.
4. **WASD support** - useful for same-keyboard local testing with two players.
5. **Shareable match links** - generate a short room code/link on "create match" so
   sending it to a second player is a single link, no manual room-name typing.

Playtesting map1's actual match length against the ~2-minute target is worth doing
now that the full core loop is live.
