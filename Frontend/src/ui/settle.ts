import { SETTLE } from '../lib/mode.ts';

// ?settle finishes every entrance animation and freezes the drift.
//
// Headless Chrome never advances CSS animations under --virtual-time-budget,
// so anything with an entrance (which here is everything) screenshots blank.
// Same trick as _settled.html one folder up. Lab only, and harmless: without
// the flag this does nothing at all.

export function settleAnimations() {
  if (!SETTLE) {
    return;
  }

  function finish() {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getTiming();
      if (timing && timing.iterations === Infinity) {
        // drift: hold it somewhere off zero so the tokens aren't in a perfect ring
        animation.currentTime = 900;
        animation.pause();
      } else {
        animation.finish();
      }
    }
  }

  // twice: once for the page, once for whatever arrived just after it
  setTimeout(finish, 300);
  setTimeout(finish, 1200);
}
