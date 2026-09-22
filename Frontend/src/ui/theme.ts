// style.md, as values. Nothing in this app invents a colour, a radius or a
// shadow: it comes from here or it doesn't exist.
//
// The numbers style.md leaves open — sizes, spacing, the page width — are
// marked GAP. They are decisions this app had to make; they belong in the
// guide once they settle.

export const color = {
  bg: 'oklch(96.8% 0.011 162)',
  panel: 'oklch(96.5% 0.022 164)',
  paper: 'oklch(99.2% 0.006 162)',
  hair: 'oklch(89% 0.03 165)',
  ink: 'oklch(28% 0.02 170)',
  inkMuted: 'oklch(48% 0.02 165)',
  inkFaint: 'oklch(56% 0.02 165)',
  mint: 'oklch(72% 0.09 165)',
  mintDeep: 'oklch(46% 0.07 166)',
  you: 'oklch(40% 0.06 168)',
  // the one tint used to mark your own words, so a bubble never needs a second hue
  mintWash: 'oklch(94.5% 0.03 164)',
} as const;

export const font = {
  // titles only
  title: "'Bricolage Grotesque', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif",
  // everything else
  mono: "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace",
} as const;

export const radius = {
  panel: 22,
  stage: 16,
  bar: 12,
  button: 7,
  chip: 4,
} as const;

// the one shadow recipe for panels
export const panelShadow =
  '0 1px 2px rgba(31,58,48,.04), 0 18px 40px -28px rgba(31,58,48,.28)';

// rings, not borders, define an avatar's state
export const ring = {
  rest: '0 0 0 1px oklch(89% 0.02 165), 0 8px 18px -12px rgba(31,58,48,.35)',
  you: '0 0 0 1px oklch(78% 0.06 165), 0 0 0 6px oklch(72% 0.09 165 / .16)',
  hot: '0 0 0 1px oklch(70% 0.09 165), 0 0 26px -4px oklch(68% 0.1 165 / .5), 0 14px 28px -12px rgba(31,58,48,.4)',
  // GAP: style.md has three rings and no fourth for "picked" or "offline".
  // Picked reuses the you halo in the deep mint; offline is the resting ring, dimmed.
  picked: '0 0 0 1px oklch(58% 0.08 166), 0 0 0 6px oklch(46% 0.07 166 / .18)',
} as const;

// the wash inside a stage, and the mint dots over it
export const stageWash =
  'radial-gradient(circle at 50% 40%, oklch(93.5% 0.038 164) 0%, oklch(97.5% 0.018 163) 72%)';
export const stageDots = 'radial-gradient(oklch(72% 0.09 165 / .3) 1px, transparent 1px)';

export const type = {
  // page and section titles. The only place the title face is allowed.
  title: { fontFamily: font.title, fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', color: color.ink },
  // a line of mono under a title
  meta: { fontFamily: font.mono, fontSize: 12, letterSpacing: '.02em', color: color.inkMuted },
  // UPPERCASE system label
  label: { fontFamily: font.mono, fontSize: 11.5, letterSpacing: '.12em', color: color.inkFaint },
  // a person's name, under their avatar
  name: { fontFamily: font.mono, fontSize: 12, fontWeight: 500, letterSpacing: '.05em', color: color.inkMuted },
  // what someone actually said, and what you type
  body: { fontFamily: font.mono, fontSize: 13, letterSpacing: '.01em', color: color.ink },
} as const;

// GAP: style.md gives no size or spacing scale. These are this app's.
export const size = {
  pageWidth: 940,
  pagePad: 48,
  pagePadNarrow: 20,
  panelGap: 40,
  panelPad: '26px 28px 22px',
  panelPadNarrow: '20px 18px 18px',
  avatar: 56,
  avatarSmall: 40,
  avatarTiny: 26,
  token: 92,
} as const;

// the width below which the page stops being a desktop page. Everything
// responsive is decided in JS, because inline styles have no media queries.
export const NARROW = 720;

export const motion = {
  hover: 'transform .32s cubic-bezier(.2,.9,.25,1)',
  fade: 'opacity .3s ease',
  reveal: 'reveal .22s ease-out backwards',
} as const;
