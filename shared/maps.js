// Canonical runtime map data, used by BOTH client and server so they never
// disagree about wall layout, kibble tiles, or spawn points. Source design files
// live in maps/*.json (see maps/README.md) - this file is the plain-JS mirror of
// them, since it needs to import cleanly in both a Vite browser bundle and a
// PartyKit/Cloudflare Workers bundle without relying on JSON-import loader
// behavior (which differs across those two build targets).
//
// TODO (see project README "Next steps"): once more maps are built, replace this
// hand-maintained mirror with a small build step that generates it from maps/*.json.

export const MAPS = {
  map1: {
    id: 'map1',
    name: 'The Living Room',
    cols: 19,
    rows: 13,
    tiles: [
    "###################",
    "#.................#",
    "#.................#",
    "#..##.........##..#",
    "#..##.........##..#",
    "#.......###.......#",
    "#.......###.......#",
    "#.......###.......#",
    "#..##.........##..#",
    "#..##.........##..#",
    "#.................#",
    "#.................#",
    "###################"
    ],
    spawnPoints: [[1,1], [17,11], [1,11], [17,1], [9,1]]
  }
};

export const MAP_IDS = Object.keys(MAPS);
