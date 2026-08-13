// Thin wrapper around a plain browser WebSocket so the game scene doesn't deal with
// connection plumbing directly. One socket = one match room, routed by the Worker's
// /party/<roomId> path (see server/worker.js).
//
// This replaced a PartySocket/PartyKit-based version after PartyKit's hosted deploy
// paths hit unresolved platform bugs - see project README "Why this isn't PartyKit".

const SERVER_HOST = import.meta.env.VITE_SERVER_HOST || 'localhost:8787';

export function connectToRoom(roomId, onMessage, opts = {}) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const query = opts.bot ? '?bot=true' : '';
  const socket = new WebSocket(`${protocol}://${SERVER_HOST}/party/${roomId}${query}`);

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  });

  socket.addEventListener('open', () => {
    console.log(`[net] connected to room ${roomId}`);
  });

  const pendingMessages = [];
  socket.addEventListener('open', () => {
    while (pendingMessages.length) socket.send(pendingMessages.shift());
  });

  return {
    send(msg) {
      const payload = JSON.stringify(msg);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else {
        // queue messages sent before the socket finishes connecting (e.g. an
        // early 'ready' click) so they aren't silently dropped
        pendingMessages.push(payload);
      }
    },
    close() {
      socket.close();
    }
  };
}
