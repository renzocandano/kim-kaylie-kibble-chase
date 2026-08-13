# Kim & Kaylie: Kibble Chase

A 2D, 8-bit-style, Pac-Man-inspired multiplayer game starring two real cats, Kim and
Kaylie. Two cats race around a maze eating kibble; when they touch, whoever has eaten
more wins and the loser vanishes for 5 seconds before respawning. Most kibble eaten
when the board is cleared wins the match.

## Project layout

- `client/` - the game itself (Phaser 3 + Vite). This is what players load in a browser.
- `server/` - the multiplayer room logic (PartyKit). One room = one match.
- `shared/gameConfig.js` - constants both client and server read from, so gameplay
  numbers (speed, respawn time, etc.) never drift out of sync between them.
- `shared/maps.js` - the canonical runtime copy of map data (walls, kibble tiles,
  spawn points), imported by both client and server so they always agree on layout.
- `maps/` - source/design copies of the maze layouts (1 of 5 built so far, see
  `maps/README.md`). `shared/maps.js` is the one actually loaded by the game.

## Design parameters (current)

- Move speed: 4 tiles/sec for both cats, always equal.
- Disappear-on-loss time: 5 seconds.
- Countdown: 3-2-1 after both players are ready.
- Target average match length: ~2 minutes (tuned via each map's kibble count,
  currently ~130-170 open tiles per map - see `shared/gameConfig.js` for the reasoning).

## Running locally

You'll need Node.js installed. Then, in two separate terminals:

```
cd server && npm install && npm run dev
```
```
cd client && npm install && npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Open a second tab with
`?room=test` in the URL to simulate a second player connecting to the same match.

## Status: playable core loop

What's already working (server logic verified with a scripted test harness, not
just syntax-checked):
- Project structure, build pipeline (Vite client builds cleanly), and PartyKit server
  connect end-to-end.
- One playable map (`map1`, "The Living Room") with walls, kibble tiles, and
  spawn points at least `MIN_SPAWN_DISTANCE_TILES` apart.
- Keyboard movement (arrow keys) at the correct tile speed, both locally and
  reported to the server per tile.
- **Kibble eating + scoring** - server is the authority on which kibble tiles
  remain and each cat's score; broadcasts updates to both players.
- **Collision resolution + 5s respawn** - when both cats occupy the same tile, the
  server declares the higher-score cat the winner, the loser disappears for
  `DISAPPEAR_MS` (5000ms) and respawns at a free spawn point. Equal scores on
  collision currently result in no elimination (a design choice worth revisiting
  after you've played it - see note in `server/index.js`).
- **Ready-up + synced 3-2-1 countdown** - match starts once both players click ready.
- **Win condition** - match ends and a winner is announced when no kibble remains.

## Next steps

1. **Bot mode** - fully client-side (no server needed): simple AI that paths toward
   the nearest kibble and avoids the opponent unless it's currently winning.
2. **Map selection** - random map chosen per match from the 5 available; build the
   remaining 4 maps (map2-5) once map1's pacing feels right from playtesting.
3. **Real sprites** - replace the placeholder colored squares with 8-bit pixel-art
   sprites of Kim and Kaylie (from the reference photos), plus simple walk-cycle
   animations.
4. **Shareable match links** - generate a short room code/link on "create match" so
   sending it to a second player is a single link, no manual room-name typing.
5. **Deploy** - `client` to Cloudflare Pages, `server` to PartyKit's free hosting
   (`npm run deploy` in `server/`), both free at this scale. Until then, see
   "Playing without hosting online yet" below.

Playtesting map1's actual match length (not just the math estimate) should happen
now that the full core loop works, since that's what determines whether the
~2-minute target needs map/kibble-count adjustments.

## Playing without hosting online yet

You don't need step 5 (deploy) to actually play right now - PartyKit and Vite both
run a local dev server on your machine, which is enough for testing.

**Both players on the same computer (fastest way to try it):**
1. `cd server && npm install && npm run dev` (starts the room server on port 1999)
2. In a second terminal: `cd client && npm install && npm run dev` (starts the game on port 5173)
3. Open `http://localhost:5173/?room=test1` in one browser tab, and the same URL
   in a second tab (or a second browser, e.g. Chrome + Firefox, to be safe about
   any shared-state quirks). Click Ready in both - that's your two cats.

**You and your girlfriend on the same wifi network (no deploy needed):**
1. Find your computer's local network IP (e.g. `192.168.1.23` - on Mac: System
   Settings > Wi-Fi > Details; on Windows: `ipconfig` in a terminal, look for IPv4 Address).
2. Start the server with `npm run dev -- --host` (some PartyKit versions bind to
   all interfaces by default - if her browser can't reach it, that flag or
   `partykit dev --host 0.0.0.0` sorts it).
3. Start the client the same way: `npm run dev -- --host` so Vite serves on your
   LAN IP too.
4. Set `VITE_PARTYKIT_HOST=192.168.1.23:1999` (your actual IP) in a `client/.env`
   file before starting the client, so her browser's game connects to your PartyKit
   server instead of trying `localhost` (which would mean *her* machine).
5. Send her `http://192.168.1.23:5173/?room=whatever-you-like` - she opens it on
   her own device, you both click Ready.

Caveat: this only works while your computer is on and both of you are on the same
network (or she's willing to fuss with port forwarding, which isn't worth it for
a first playtest). Real hosting (step 5) is what removes that restriction.
