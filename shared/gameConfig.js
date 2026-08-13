// Shared game constants - used by both client and server so they never drift apart.

export const TILE_SIZE = 32; // pixels per grid tile

// Movement
export const MOVE_SPEED_TILES_PER_SEC = 4; // both cats always move at this same speed

// Combat / respawn
export const DISAPPEAR_MS = 5000; // loser of a collision is gone for 5 seconds
export const MIN_SPAWN_DISTANCE_TILES = 6; // cats never spawn closer than this apart

// Countdown
export const COUNTDOWN_SECONDS = 3; // 3-2-1-GO after both players click start

// Pacing target (used when tuning maps, not enforced by code)
// Design intent: an average 1v1 or 1v-bot match should last ~120 seconds.
// At MOVE_SPEED_TILES_PER_SEC = 4, a single cat could clear ~4 tiles/sec if kibble
// were in a straight uninterrupted line. In practice mazes force backtracking and
// two cats splitting the map roughly halves the time needed vs. one cat alone.
// Each map's total kibble count (see maps/*.json) should land in the ~130-170 tile
// range to hit ~120s in practice - verify with real playtesting, not just math.
export const TARGET_AVERAGE_GAME_LENGTH_SEC = 120;
export const TARGET_KIBBLE_COUNT_RANGE = [130, 170];

export const MAP_IDS = ['map1', 'map2', 'map3', 'map4', 'map5'];
