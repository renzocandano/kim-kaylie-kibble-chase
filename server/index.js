// DEPRECATED - no longer used.
//
// This was the original PartyKit-based server implementation. PartyKit's hosted
// deploy paths (both managed and "deploy to your own Cloudflare account") hit
// unresolved platform bugs, so the project moved to a plain Cloudflare Worker +
// Durable Object implementation instead - see worker.js, which has the same game
// logic (kibble eating, collisions, respawn, countdown, win condition) wired to
// Cloudflare's own APIs directly.
//
// Kept only because the sandbox that generated this project couldn't delete the
// file. Safe to delete by hand.
