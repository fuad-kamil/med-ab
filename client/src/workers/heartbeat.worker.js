/**
 * heartbeat.worker.js
 *
 * A Web Worker that fires a TICK message every ~15 seconds with ±3s jitter.
 * Running in a Web Worker means background tab throttling (which can delay
 * setInterval in the main thread by up to 60s on mobile browsers) does NOT
 * affect the heartbeat.
 *
 * The main thread can send:
 *   { type: 'START' }   — begin ticking
 *   { type: 'STOP' }    — stop ticking
 *   { type: 'PING' }    — request immediate tick (e.g. after visibility change)
 */

const HEARTBEAT_MS = 15_000;
const JITTER_MS = 3_000;

let timerId = null;

function jitteredInterval() {
  return HEARTBEAT_MS + (Math.random() * JITTER_MS * 2 - JITTER_MS);
}

function tick() {
  self.postMessage({ type: 'TICK' });
  // Reschedule with fresh jitter
  if (timerId !== null) {
    timerId = setTimeout(tick, jitteredInterval());
  }
}

self.onmessage = function (e) {
  const { type } = e.data || {};

  if (type === 'START') {
    if (timerId !== null) return; // already running
    timerId = setTimeout(tick, jitteredInterval());
  } else if (type === 'STOP') {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  } else if (type === 'PING') {
    // Immediate tick, reset timer
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    self.postMessage({ type: 'TICK' });
    timerId = setTimeout(tick, jitteredInterval());
  }
};
