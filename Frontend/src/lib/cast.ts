import type { Participant } from '../components/JoinScreen.tsx';

// The people the artwork was drawn with. None of them are real and none of
// them are meant to be: the faces on the door are scenery, and the door is the
// one screen in this app that draws anybody it cannot see. Everywhere past it,
// every name and every face belongs to somebody actually on the wi-fi.
export const DEFAULT_PARTICIPANTS: Participant[] = [
  { name: 'Nina', animal: 'fox' },
  { name: 'Mia', animal: 'panda' },
  { name: 'Nora', animal: 'cat' },
  { name: 'Leo', animal: 'bear' },
  { name: 'Ava', animal: 'fox' },
  { name: 'Owl', animal: 'owl' },
  { name: 'Bear', animal: 'bear' },
  { name: 'Frog', animal: 'frog' },
  { name: 'Leo', animal: 'fox' },
  { name: 'Chloe', animal: 'cat' },
  { name: 'Ava', animal: 'fox' },
];
