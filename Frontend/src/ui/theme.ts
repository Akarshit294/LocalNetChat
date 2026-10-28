// style.md, as values. Nothing in this app invents a colour, a radius or a
// shadow: it comes from here or it doesn't exist.
//
// The numbers style.md leaves open — sizes, spacing, the page width — are
// marked GAP. They are decisions this app had to make; they belong in the
// guide once they settle.

// Every colour twice: once for a light room, once for a dark one, under the
// same names. Nothing reads these two directly. Pages use `color` below, whose
// values are CSS variables, and GlobalStyle sets those variables from one
// palette or the other, following the light/dark setting of the device. So a
// component writes `color.ink` and never knows which room it is in.
const light = {
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
  // GAP: style.md has nothing that sits over a page. This is the ink, thinned,
  // so the page behind a call goes quiet without disappearing.
  scrim: 'oklch(28% 0.02 170 / .45)',
  // the colour of every shadow, before it is thinned
  shadow: 'rgb(31 58 48)',
  // the edge of each avatar ring (see `ring`), and the glow around a held one
  ringRest: 'oklch(89% 0.02 165)',
  ringYou: 'oklch(78% 0.06 165)',
  ringHot: 'oklch(70% 0.09 165)',
  ringPicked: 'oklch(58% 0.08 166)',
  glowHot: 'oklch(68% 0.1 165)',
  // the lit middle of a stage, and its edge
  washCentre: 'oklch(93.5% 0.038 164)',
  washEdge: 'oklch(97.5% 0.018 163)',
};

// GAP: style.md has no dark room. This one keeps the same mint hue and turns
// the lightness over: paper still sits above the panel, and the panel above
// the page, but here "above" means lighter. Text is at least as easy to read
// as it is in the light.
const dark: typeof light = {
  bg: 'oklch(19.5% 0.014 168)',
  panel: 'oklch(22.5% 0.019 166)',
  paper: 'oklch(26.2% 0.018 165)',
  hair: 'oklch(33.5% 0.026 166)',
  ink: 'oklch(91.5% 0.016 160)',
  inkMuted: 'oklch(76% 0.02 163)',
  inkFaint: 'oklch(68% 0.02 164)',
  mint: 'oklch(74% 0.1 165)',
  mintDeep: 'oklch(50% 0.08 166)',
  you: 'oklch(84% 0.075 165)',
  mintWash: 'oklch(31% 0.042 166)',
  scrim: 'oklch(12% 0.012 170 / .62)',
  shadow: 'oklch(8% 0.01 170)',
  ringRest: 'oklch(36% 0.025 166)',
  ringYou: 'oklch(60% 0.07 165)',
  ringHot: 'oklch(74% 0.1 165)',
  ringPicked: 'oklch(62% 0.09 166)',
  glowHot: 'oklch(70% 0.11 165)',
  washCentre: 'oklch(29% 0.045 165)',
  washEdge: 'oklch(23.5% 0.018 166)',
};

export const palette = { light, dark };

export type ColorName = keyof typeof light;

// `color.ink` is the string 'var(--ink)'.
export const color = Object.fromEntries(
  Object.keys(light).map((name) => [name, `var(--${name})`]),
) as Record<ColorName, string>;

// A colour made see-through: `alpha(color.mint, 16)` is the mint at 16%.
// It works on a variable, which `oklch(... / .16)` can't.
export function alpha(of: string, percent: number) {
  return `color-mix(in oklch, ${of} ${percent}%, transparent)`;
}

// the mint halo for "this is you", and for a button under the cursor
export const halo = alpha(color.mint, 16);

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
  `0 1px 2px ${alpha(color.shadow, 4)}, 0 18px 40px -28px ${alpha(color.shadow, 28)}`;

// rings, not borders, define an avatar's state
export const ring = {
  rest: `0 0 0 1px ${color.ringRest}, 0 8px 18px -12px ${alpha(color.shadow, 35)}`,
  you: `0 0 0 1px ${color.ringYou}, 0 0 0 6px ${halo}`,
  hot: `0 0 0 1px ${color.ringHot}, 0 0 26px -4px ${alpha(color.glowHot, 50)}, 0 14px 28px -12px ${alpha(color.shadow, 40)}`,
  // GAP: style.md has three rings and no fourth for "picked" or "offline".
  // Picked reuses the you halo in the deep mint; offline is the resting ring, dimmed.
  picked: `0 0 0 1px ${color.ringPicked}, 0 0 0 6px ${alpha(color.mintDeep, 18)}`,
} as const;

// the wash inside a stage, and the mint dots over it
export const stageWash =
  `radial-gradient(circle at 50% 40%, ${color.washCentre} 0%, ${color.washEdge} 72%)`;
export const stageDots = `radial-gradient(${alpha(color.mint, 30)} 1px, transparent 1px)`;

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
  // the room going dark or light: every colour fades across together
  scheme: '.6s ease',
} as const;
