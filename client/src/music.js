// Background music: plays the user's own recording (client/public/audio/bg-music.mp3)
// on a seamless loop via the Web Audio API. The source file was preprocessed
// offline (silence trimmed, then the tail crossfaded into the head) so looping
// it doesn't produce an audible click or repeat-pop at the seam.
//
// Must be started from inside a real user gesture (a click) - browsers block
// audio from starting on its own. See GameScene's mode-select buttons.

const MUSIC_URL = '/audio/bg-music.mp3';
// 5/100 on the same 0-100 scale used for the original chiptune loop (which was
// 20/100 there). This is a real recording rather than a synthesized tone, so
// the same numeric gain will sound different, but this is the requested value.
const VOLUME = 0.05;

let ctx = null;
let masterGain = null;
let audioBuffer = null;
let sourceNode = null;
let playing = false;
let loadPromise = null;

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = VOLUME;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

async function loadBuffer() {
  if (audioBuffer) return audioBuffer;
  if (!loadPromise) {
    loadPromise = fetch(MUSIC_URL)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => { audioBuffer = buf; return buf; });
  }
  return loadPromise;
}

// Starts the background loop. Safe to call multiple times - a no-op if already
// playing. Must be called from within a user gesture handler (e.g. a click).
export async function startBackgroundMusic() {
  if (playing) return;
  playing = true;
  try {
    ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const buf = await loadBuffer();
    if (!playing) return; // stopBackgroundMusic() may have been called while loading

    sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buf;
    sourceNode.loop = true;
    sourceNode.connect(masterGain);
    sourceNode.start(0);
  } catch (err) {
    // Previously this failure was silent (an unhandled rejection with no visible
    // error and `playing` stuck true forever, blocking any retry). Log it and
    // reset state so at least it's diagnosable and a fresh page load can retry.
    console.error('[music] failed to start background music:', err);
    playing = false;
  }
}

export function stopBackgroundMusic() {
  playing = false;
  if (sourceNode) {
    try { sourceNode.stop(); } catch { /* already stopped */ }
    sourceNode = null;
  }
}
