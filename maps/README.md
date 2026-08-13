# Map format

Each map is a JSON file with:
- `id`, `name` - identifiers
- `cols`, `rows` - grid dimensions
- `tiles` - array of strings, one per row. `#` = wall, `.` = open path (kibble spawns here at match start)
- `spawnPoints` - array of `[col, row]` open tiles. The server picks 2 that are at least
  `MIN_SPAWN_DISTANCE_TILES` apart (see shared/gameConfig.js) each match.

## Status
- `map1.json` - done (The Living Room), 162 kibble tiles
- `map2.json` - TODO (The Hallway)
- `map3.json` - TODO (The Kitchen)
- `map4.json` - TODO (The Bedroom)
- `map5.json` - TODO (The Catio)

Aim for each map's open-tile count to land in the 130-170 range (see
`TARGET_KIBBLE_COUNT_RANGE` in shared/gameConfig.js) so match length stays close to ~2 minutes.
