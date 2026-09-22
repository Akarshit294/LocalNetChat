import type { CSSProperties } from 'react';

// Ambient drift: a small translate, 7-13s, alternating, with a negative delay
// so no two tokens are ever in step. Everything is derived from a seed, so a
// person drifts the same way for as long as they are here.
export function driftStyle(seed: number): CSSProperties {
  const duration = 7 + (seed % 7);
  const dx = (8 + (seed % 7)) * (seed % 2 ? 1 : -1);
  const dy = (8 + ((seed >> 2) % 6)) * (seed % 3 ? -1 : 1);
  return {
    animation: `drift ${duration}s ease-in-out infinite alternate`,
    animationDelay: `-${seed % 13}s`,
    // read by the drift keyframes
    ['--dx' as string]: `${dx}px`,
    ['--dy' as string]: `${dy}px`,
  };
}

// Everything that appears does it the same way. `backwards`, never `both`:
// `both` pins the end transform and kills the hover lift underneath it.
export function revealStyle(delayMs = 0): CSSProperties {
  return {
    animation: 'reveal .22s ease-out backwards',
    animationDelay: `${delayMs}ms`,
  };
}
