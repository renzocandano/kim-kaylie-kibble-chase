// Tiny, dependency-free 8-bit "elevator music" background loop, generated live
// with the Web Audio API (no external audio files). Kept deliberately simple: a
// short, gentle chord-arpeggio loop at low volume so it sits in the background
// rather than competing with the game.
//
// Must be started from inside a real user gesture (a click) - browsers block
// audio from starting on its own. See GameScene's mode-select buttons.

const NOTE_HZ = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25
};

// Simple, pleasant 8-note loop - mellow major-key arpeggio, "elevator music" vibe.
const SEQUENCE = ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'D4', 'G4'];
const NOTE_DURATION_SEC = 0.45;
const MAX_VOLUME = 0.2; // 20/100 as requested

let ctx = null;
let masterGain = null;
let loopTimer = null;
let stepIndex = 0;
let playing = false;

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = MAX_VOLUME;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function playNote(freq, whenSec) {
  const osc = ctx.createOscillator();
  osc.type = 'square'; // classic 8-bit chiptune timbre
  osc.frequency.value = freq;

  // per-note envelope so notes don't click or blend into a drone
  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0, whenSec);
  noteGain.gain.linearRampToValueAtTime(1, whenSec + 0.03);
  noteGain.gain.linearRampToValueAtTime(0, whenSec + NOTE_DURATION_SEC * 0.9);

  osc.connect(noteGain);
  noteGain.connect(masterGain);
  osc.start(whenSec);
  osc.stop(whenSec + NOTE_DURATION_SEC);
}

function scheduleNext() {
  if (!playing) return;
  const note = SEQUENCE[stepIndex % SEQUENCE.length];
  playNote(NOTE_HZ[note], ctx.currentTime);
  stepIndex += 1;
  loopTimer = setTimeout(scheduleNext, NOTE_DURATION_SEC * 1000);
}

// Starts the background loop. Safe to call multiple times - a no-op if already
// playing. Must be called from within a user gesture handler (e.g. a click).
export function startBackgroundMusic() {
  if (playing) return;
  ensureContext();
  if (ctx.state === 'suspended') ctx.resume();
  playing = true;
  scheduleNext();
}

export function stopBackgroundMusic() {
  playing = false;
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = null;
}
