import { useState, useSyncExternalStore } from 'react';
import { NARROW } from './theme.ts';

// Hover is state, and inline styles have no :hover. Every hovered thing in
// this app holds its own flag and swaps its own style.
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    // spread onto the element that should react
    bind: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setHovered(true),
      onBlur: () => setHovered(false),
    },
  };
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

// Inline styles have no media queries either, so the breakpoint is read here.
// useSyncExternalStore rather than an effect, because the lint rule
// react-hooks/set-state-in-effect refuses setState inside useEffect.
export function useViewportWidth() {
  return useSyncExternalStore(subscribe, () => window.innerWidth);
}

export function useNarrow() {
  return useViewportWidth() < NARROW;
}
