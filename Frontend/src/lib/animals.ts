// The avatar sheet: 20 animals, 5 across, 4 down, each already cut to a circle
// with a transparent corner. See ../../../make-sprite.py in the lab folder.
//
// The page stores a tile *index*, never a name, so it does not care what the
// animals are. The names below are only ever shown to you, about you.
export const ANIMALS = [
  'dog', 'cat', 'elephant', 'lion', 'tiger',
  'bear', 'giraffe', 'zebra', 'monkey', 'horse',
  'cow', 'pig', 'sheep', 'goat', 'rooster',
  'fox', 'rabbit', 'mouse', 'snake', 'frog',
] as const;

export const SHEET_COLS = 5;
export const SHEET_ROWS = 4;

// A stable number out of a string. The same id always draws the same animal,
// so nobody has to send one.
export function hash(text: string): number {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}

export function tileOf(id: string): number {
  return hash(id) % (SHEET_COLS * SHEET_ROWS);
}

export function animalOf(id: string): string {
  return ANIMALS[tileOf(id)];
}

// CAVEAT for the copy into LocalNetChat: the server makes a fresh user id on
// every connection, so hashing the id gives you a new animal every time you
// reconnect. style.md calls the animal "permanent per device", which needs the
// page to keep its own id in localStorage and hash that instead.
