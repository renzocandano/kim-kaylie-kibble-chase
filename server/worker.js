import { COUNTDOWN_SECONDS, DISAPPEAR_MS, MIN_SPAWN_DISTANCE_TILES } from '../shared/gameConfig.js';
import { MAPS } from '../shared/maps.js';

// Plain Cloudflare Worker + Durable Object implementation of the multiplayer room.
// This replaces the earlier PartyKit-based server (see git history / README) after
// PartyKit's hosted deploy paths hit unresolved platform bugs. Same game rules as
// before, just wired directly to Cloudflare's own APIs instead of PartyKit's SDK.
//
// One Durable Object instance = one match room, looked up by room id from the URL.
// Movement is client-authoritative (client reports the tile it walked onto); the
// server is the sole authority on kibble, collisions, and match start/end.

const MAP = MAPS.map1; // TODO: random map selection once more maps exist (see README)

function manhattan(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function pickSpawnPair(spawnPoints) {
  for (const a of spawnPoints) {
    for (const b of spawnPoints) {
      if (a === b) continue;
      if (manhattan(a, b) >= MIN_SPAWN_DISTANCE_TILES) return [a, b];
    }
  }
  let best = [spawnPoints[0], spawnPoints[1]];
  let bestDist = -1;
  for (const a of spawnPoints) {
    for (const b of spawnPoints) {
      if (a === b) continue;
      const d = manhattan(a, b);
      if (d > bestDist) { bestDist = d; best = [a, b]; }
    }
  }
  return best;
}

function allKibbleTiles(map) {
  const kibble = new Set();
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      if (map.tiles[row][col] !== '#') kibble.add(`${col},${row}`);
    }
  }
  return kibble;
}

export class KibbleChaseRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = new Map(); // connId -> { ws, catId, col, row, score, alive, ready }
    this.nextConnId = 1;
    this.spawnPair = pickSpawnPair(MAP.spawnPoints);
    this.kibble = allKibbleTiles(MAP);
    this.started = false;
    this.matchOver = false;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket connection', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    if (this.players.size >= 2) {
      server.send(JSON.stringify({ type: 'full' }));
      server.close(1000, 'Room full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const connId = `c${this.nextConnId++}`;
    this.onConnect(connId, server);

    server.addEventListener('message', (evt) => this.onMessage(connId, evt.data));
    server.addEventListener('close', () => this.onClose(connId));
    server.addEventListener('error', () => this.onClose(connId));

    return new Response(null, { status: 101, webSocket: client });
  }

  onConnect(connId, ws) {
    // Snapshot existing players BEFORE adding the new one, so we can tell the new
    // connection about anyone already in the room (bug fix: previously only the
    // *existing* player was told "someone joined" - the new player never learned
    // an opponent was already there, so their Ready button never appeared).
    const existingPlayers = [...this.players.values()].map(p => ({ catId: p.catId, col: p.col, row: p.row }));

    const catId = this.players.size === 0 ? 'kim' : 'kaylie';
    const spawn = this.spawnPair[this.players.size];
    this.players.set(connId, { connId, ws, catId, col: spawn[0], row: spawn[1], score: 0, alive: true, ready: false });

    ws.send(JSON.stringify(this.welcomePayload(catId, spawn, existingPlayers)));

    this.broadcastExcept(connId, { type: 'playerJoined', catId, col: spawn[0], row: spawn[1] });
  }

  welcomePayload(catId, spawn, existingPlayers) {
    return {
      type: 'welcome',
      catId,
      spawn,
      map: { id: MAP.id, name: MAP.name, cols: MAP.cols, rows: MAP.rows, tiles: MAP.tiles },
      kibble: Array.from(this.kibble),
      config: { COUNTDOWN_SECONDS, DISAPPEAR_MS },
      existingPlayers
    };
  }

  onMessage(connId, message) {
    let msg;
    try { msg = JSON.parse(message); } catch { return; }
    const player = this.players.get(connId);
    if (!player) return;

    if (msg.type === 'ready') {
      player.ready = true;
      const allReady = this.players.size === 2 && [...this.players.values()].every(p => p.ready);
      if (allReady && !this.started) this.startCountdown();
      return;
    }

    if (msg.type === 'move') {
      this.handleMove(connId, player, msg);
      return;
    }
  }

  startCountdown() {
    let remaining = COUNTDOWN_SECONDS;
    this.broadcast({ type: 'countdown', value: remaining });
    const tick = () => {
      remaining -= 1;
      if (remaining > 0) {
        this.broadcast({ type: 'countdown', value: remaining });
        setTimeout(tick, 1000);
      } else {
        this.started = true;
        this.broadcast({ type: 'start' });
      }
    };
    setTimeout(tick, 1000);
  }

  handleMove(connId, player, msg) {
    if (!this.started || this.matchOver || !player.alive) return;
    if (typeof msg.col !== 'number' || typeof msg.row !== 'number') return;

    player.col = msg.col;
    player.row = msg.row;
    this.broadcastExcept(connId, { type: 'playerMoved', catId: player.catId, col: player.col, row: player.row });

    for (const [otherId, other] of this.players) {
      if (otherId === connId) continue;
      if (other.alive && other.col === player.col && other.row === player.row) {
        this.resolveCollision(connId, otherId);
        return;
      }
    }

    const key = `${player.col},${player.row}`;
    if (this.kibble.has(key)) {
      this.kibble.delete(key);
      player.score += 1;
      this.broadcast({ type: 'kibbleEaten', col: player.col, row: player.row, catId: player.catId, score: player.score });
      if (this.kibble.size === 0) this.endMatch();
    }
  }

  resolveCollision(idA, idB) {
    const a = this.players.get(idA);
    const b = this.players.get(idB);

    if (a.score === b.score) {
      this.broadcast({ type: 'collision', tie: true, a: a.catId, b: b.catId });
      return;
    }

    const [winner, loserId, loser] = a.score > b.score ? [a, idB, b] : [b, idA, a];
    loser.alive = false;
    this.broadcast({ type: 'collision', winner: winner.catId, loser: loser.catId, disappearMs: DISAPPEAR_MS });

    setTimeout(() => {
      if (this.matchOver) return;
      const respawn = this.pickRespawnPoint(loserId);
      loser.alive = true;
      loser.col = respawn[0];
      loser.row = respawn[1];
      this.broadcast({ type: 'respawn', catId: loser.catId, col: respawn[0], row: respawn[1] });
    }, DISAPPEAR_MS);
  }

  pickRespawnPoint(loserId) {
    const others = [...this.players.entries()].filter(([id]) => id !== loserId).map(([, p]) => p);
    const candidates = MAP.spawnPoints.filter(([c, r]) =>
      !others.some(o => o.alive && o.col === c && o.row === r)
    );
    const pool = candidates.length > 0 ? candidates : MAP.spawnPoints;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  endMatch() {
    this.matchOver = true;
    const scores = {};
    for (const p of this.players.values()) scores[p.catId] = p.score;
    const [catA, catB] = Object.keys(scores);
    let winner = 'tie';
    if (catA && catB) {
      if (scores[catA] > scores[catB]) winner = catA;
      else if (scores[catB] > scores[catA]) winner = catB;
    }
    this.broadcast({ type: 'gameOver', scores, winner });
    // Without this, the room stayed permanently "finished" after a normal win
    // (matchOver/started never cleared, kibble left empty) - any later reconnect
    // inherited that dead state instead of a fresh board. Same reset path as a
    // mid-match disconnect, just triggered by a clean finish instead.
    setTimeout(() => this.resetRoom(), 3000);
  }

  onClose(connId) {
    const player = this.players.get(connId);
    if (!player) return;
    this.players.delete(connId);

    if (this.started && !this.matchOver) {
      // A live match lost a player (disconnect or page refresh) - the remaining
      // player wins by default, then the room resets after a short pause so a new
      // match can start without needing a brand new room link.
      this.matchOver = true;
      const scores = {};
      for (const p of this.players.values()) scores[p.catId] = p.score;
      scores[player.catId] = player.score;
      const remaining = [...this.players.values()][0];
      this.broadcast({
        type: 'gameOver',
        scores,
        winner: remaining ? remaining.catId : player.catId,
        reason: 'opponentDisconnected'
      });
      setTimeout(() => this.resetRoom(), 3000);
    } else {
      // Not yet in a match (still in the lobby / ready-up screen) - this is also
      // what fixes the "stuck on Waiting for opponent forever" bug: whoever's left
      // gets told their opponent is gone and their ready state is cleared, instead
      // of the room silently holding a stale slot open.
      for (const p of this.players.values()) p.ready = false;
      this.broadcast({ type: 'opponentLeft', catId: player.catId });
    }
  }

  resetRoom() {
    // Reset match state but keep any still-connected player(s) in the room,
    // reassigning them a fresh catId/spawn and sending them a new 'welcome' so
    // their client redraws into a clean lobby instead of being silently dropped.
    const survivors = [...this.players.values()];
    this.players.clear();
    this.spawnPair = pickSpawnPair(MAP.spawnPoints);
    this.kibble = allKibbleTiles(MAP);
    this.started = false;
    this.matchOver = false;

    survivors.forEach((old, i) => {
      const catId = i === 0 ? 'kim' : 'kaylie';
      const spawn = this.spawnPair[i];
      this.players.set(old.connId, { connId: old.connId, ws: old.ws, catId, col: spawn[0], row: spawn[1], score: 0, alive: true, ready: false });
      try { old.ws.send(JSON.stringify(this.welcomePayload(catId, spawn, []))); } catch { /* socket may already be closing */ }
    });
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const p of this.players.values()) {
      try { p.ws.send(payload); } catch { /* socket may already be closing */ }
    }
  }

  broadcastExcept(exceptId, data) {
    const payload = JSON.stringify(data);
    for (const [id, p] of this.players) {
      if (id === exceptId) continue;
      try { p.ws.send(payload); } catch { /* socket may already be closing */ }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/party\/([A-Za-z0-9_-]+)$/);
    if (!match) {
      return new Response('Kim & Kaylie: Kibble Chase server. Connect via /party/<roomId>.', { status: 200 });
    }
    const roomId = match[1];
    const id = env.KIBBLE_ROOM.idFromName(roomId);
    const stub = env.KIBBLE_ROOM.get(id);
    return stub.fetch(request);
  }
};
