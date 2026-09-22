'use client';

/**
 * JoinScreen — "just your name" entry screen with a floating participant network.
 *
 * Single file, React 18+, no other dependencies. Styles are injected by the component
 * (class names are prefixed `jn-`). Uses IBM Plex Mono when available; set `--jn-font` on a
 * parent element to use another typeface. Text sizes are real px and do not scale with the stage.
 *
 *   <JoinScreen onJoin={async (name) => { await joinRoom(name); }} />
 *
 * The artwork is laid out on a fixed 1600×872 stage that scales to fit its container.
 *
 * LOCAL: made in Claude design, then edited here. Every change is marked LOCAL,
 * so a regenerated copy can be diffed against this one:
 *   - the input can be controlled from outside (`value` / `onValueChange`)
 *   - one `note` line under the box, for the rule you are breaking
 *   - `blocked`, so a name the server would refuse shakes instead of joining
 *   - `renderAvatar`, so the app draws its own faces from its own sprite sheet
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactElement, ReactNode } from 'react';
// LOCAL: the cast lives in its own file so the page can fill empty slots with
// it, and so this file exports nothing but components.
import { DEFAULT_PARTICIPANTS } from '../lib/cast.ts';

export type AnimalKind = 'fox' | 'panda' | 'bear' | 'owl' | 'frog' | 'cat';

export interface Participant {
  name: string;
  /** Ignored when the host draws its own faces — see `renderAvatar`. */
  animal?: AnimalKind;
  /** LOCAL: whatever the host needs to tell one person from another. */
  id?: string;
}

export interface JoinScreenProps {
  /** Receives the trimmed name. Return a promise to show a loading state until it settles. */
  onJoin?: (name: string) => void | Promise<unknown>;
  /** Avatars floating around the form. The first 11 fill the preset positions. */
  participants?: Participant[];
  label?: string;
  placeholder?: string;
  buttonLabel?: string;
  maxLength?: number;
  /** Ambient motion. Always off when the user prefers reduced motion. */
  animated?: boolean;
  /** Blur and fade distant avatars. */
  depthOfField?: boolean;
  className?: string;
  style?: CSSProperties;
  /** LOCAL: control the box from outside. Left out, it keeps its own name. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** LOCAL: one line under the box — the rule being broken, or the server's answer. */
  note?: ReactNode;
  /** LOCAL: this name cannot be used yet, so joining shakes instead. */
  blocked?: boolean;
  /** LOCAL: draw the face yourself, disc and all. */
  renderAvatar?: (participant: Participant) => ReactNode;
}

/* ─── Stage geometry (design units on a 1600 × 872 stage) ─── */

const STAGE_W = 1600;
const STAGE_H = 872;

interface Slot { x: number; y: number; blur: number; opacity: number }

const SLOT_POINTS: ReadonlyArray<readonly [number, number]> = [
  [360, 178], [645, 180], [970, 182], [1110, 318], [1248, 366], [360, 527],
  [523, 548], [1121, 512], [415, 689], [980, 668], [1247, 671],
];

// LOCAL: one depth for everybody.
//
// The design gave each slot its own blur (0 to 3.2) and opacity (0.5 to 1), a
// lens focused on whoever stands in the first two places and losing the rest.
// Here nobody in the ring is more important than anybody else, so they are all
// at the same distance. `depthOfField={false}` still flattens it completely.
const SLOT_BLUR = 0.6;
const SLOT_OPACITY = 1;

const SLOTS: Slot[] = SLOT_POINTS.map(([x, y]) => ({
  x,
  y,
  blur: SLOT_BLUR,
  opacity: SLOT_OPACITY,
}));

interface Particle { x: number; y: number; size: number; blur: number }

const PARTICLES: Particle[] = [
  { x: 474, y: 355, size: 40, blur: 3 },
  { x: 275, y: 378, size: 13, blur: 0.8 },
  { x: 562, y: 285, size: 8, blur: 0 },
  { x: 1211, y: 264, size: 15, blur: 1 },
  { x: 1284, y: 248, size: 21, blur: 2 },
  { x: 1384, y: 235, size: 34, blur: 4 },
  { x: 1320, y: 509, size: 8, blur: 0.5 },
];

const LINKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [402, 206, 558, 284],
  [404, 506, 522, 486],
  [448, 656, 494, 616],
  [1066, 578, 1206, 646],
];

/* Ribbons inside the orb (orb-local units, 544 × 544). A "fan" is a set of circles that all touch
   at one pinch point and spread apart along `dir`, which reads as a twisting ribbon of lines. */

interface Circle { cx: number; cy: number; r: number }
interface Fan { pinch: readonly [number, number]; dir: readonly [number, number]; r0: number; r1: number; count: number }

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const round1 = (n: number): number => Math.round(n * 10) / 10;

const FAN_TOP: Fan = { pinch: [236, 86], dir: [0.3, 0.954], r0: 180, r1: 250, count: 38 };
const FAN_BOTTOM: Fan = { pinch: [358, 441], dir: [-0.42, -0.908], r0: 225, r1: 305, count: 34 };

function fanCircle(f: Fan, r: number): Circle {
  return { cx: round1(f.pinch[0] + f.dir[0] * r), cy: round1(f.pinch[1] + f.dir[1] * r), r };
}

function fanLines(f: Fan): Circle[] {
  return Array.from({ length: f.count }, (_, i) => fanCircle(f, round1(lerp(f.r0, f.r1, i / (f.count - 1)))));
}

function fanPoint(f: Fan, u: number, deg: number): readonly [number, number] {
  const c = fanCircle(f, lerp(f.r0, f.r1, u));
  const t = (deg * Math.PI) / 180;
  return [round1(c.cx + c.r * Math.cos(t)), round1(c.cy + c.r * Math.sin(t))];
}

const circlePath = ({ cx, cy, r }: Circle): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** Crescent between two circles of a fan (fill with evenodd). */
const fanBand = (f: Fan, from = f.r0, to = f.r1): string => circlePath(fanCircle(f, from)) + circlePath(fanCircle(f, to));

const RIBBON_TOP = fanLines(FAN_TOP);
const RIBBON_BOTTOM = fanLines(FAN_BOTTOM);
const RIBBON_RIM: Circle[] = Array.from({ length: 18 }, (_, i) => {
  const u = i / 17;
  return { cx: round1(lerp(264, 280, u)), cy: round1(lerp(278, 266, u)), r: round1(lerp(252, 270, u)) };
});

interface Spark { at: readonly [number, number]; r: number; glint?: boolean }

const SPARKS: Spark[] = [
  { at: fanPoint(FAN_TOP, 0.15, -80), r: 1 },
  { at: fanPoint(FAN_TOP, 0.5, -70), r: 1.2 },
  { at: fanPoint(FAN_TOP, 0.8, -58), r: 0.9 },
  { at: fanPoint(FAN_TOP, 0.35, -48), r: 2.2, glint: true },
  { at: fanPoint(FAN_TOP, 0.65, -35), r: 1 },
  { at: fanPoint(FAN_TOP, 0.2, -20), r: 0.8 },
  { at: fanPoint(FAN_TOP, 0.9, -12), r: 1.1 },
  { at: fanPoint(FAN_BOTTOM, 0.1, 82), r: 0.9 },
  { at: fanPoint(FAN_BOTTOM, 0.3, 92), r: 1.8, glint: true },
  { at: fanPoint(FAN_BOTTOM, 0.55, 104), r: 1 },
  { at: fanPoint(FAN_BOTTOM, 0.2, 116), r: 0.8 },
  { at: fanPoint(FAN_BOTTOM, 0.7, 126), r: 1.2 },
  { at: fanPoint(FAN_BOTTOM, 0.45, 138), r: 2, glint: true },
  { at: fanPoint(FAN_BOTTOM, 0.85, 150), r: 0.9 },
  { at: fanPoint(FAN_BOTTOM, 0.6, 164), r: 1 },
  { at: fanPoint(FAN_BOTTOM, 0.3, 176), r: 0.8 },
];

const starPath = (x: number, y: number, s: number): string =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

/** Card outline: tab on the top-left, collar around the Join button (card-local px, 463 × 372). */
const CARD_PATH =
  'M0 40C0 17.9 17.9 0 40 0H205C256 0 258 65 309 65H429C447.8 65 463 80.2 463 99V297A75 75 0 0 1 318.96 326.3C308.8 302.4 280 267 236 267H30C13.4 267 0 253.6 0 237Z';

/* ─── Animal icons (48 × 48) ─── */

const MINT = '#8fd3b6';
const MINT_SOFT = '#dcf2e8';
const INK = '#434a48';
const INK_DEEP = '#2e3331';
const GRAY = '#6f7473';

const ICONS: Record<AnimalKind, ReactElement> = {
  fox: (
    <>
      <path d="M6 6.5L19.5 15H28.5L42 6.5L40.5 22.5L44 25L24 42.5L4 25L7.5 22.5Z" fill={MINT} />
      <path d="M9.2 10.6L16.8 15.6L10.4 20.4ZM38.8 10.6L31.2 15.6L37.6 20.4Z" fill={INK} />
      <path d="M4 25L16.5 28L24 42.5ZM44 25L31.5 28L24 42.5Z" fill={MINT_SOFT} />
      <path d="M14.5 23.2Q17.5 21.4 20 23.6Q17.2 25.2 14.5 23.2ZM33.5 23.2Q30.5 21.4 28 23.6Q30.8 25.2 33.5 23.2Z" fill={INK} />
      <path d="M21.6 38.6H26.4L24 42Z" fill={INK} />
    </>
  ),
  panda: (
    <>
      <circle cx="11.5" cy="12.5" r="6.5" fill={INK_DEEP} />
      <circle cx="36.5" cy="12.5" r="6.5" fill={INK_DEEP} />
      <ellipse cx="24" cy="26" rx="18" ry="16" fill="#ffffff" stroke="#d3d9d7" strokeWidth="1" />
      <ellipse cx="16.5" cy="25" rx="4.6" ry="5.8" transform="rotate(35 16.5 25)" fill={INK_DEEP} />
      <ellipse cx="31.5" cy="25" rx="4.6" ry="5.8" transform="rotate(-35 31.5 25)" fill={INK_DEEP} />
      <circle cx="17.3" cy="24.2" r="1.7" fill="#ffffff" />
      <circle cx="30.7" cy="24.2" r="1.7" fill="#ffffff" />
      <ellipse cx="24" cy="31.2" rx="2.8" ry="2" fill={INK_DEEP} />
      <path d="M21.2 34.4Q24 36.6 26.8 34.4" fill="none" stroke={INK_DEEP} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  bear: (
    <>
      <circle cx="11" cy="12" r="7" fill={GRAY} />
      <circle cx="37" cy="12" r="7" fill={GRAY} />
      <circle cx="11" cy="12" r="3.4" fill="#5a5f5e" />
      <circle cx="37" cy="12" r="3.4" fill="#5a5f5e" />
      <ellipse cx="24" cy="26" rx="18" ry="16.5" fill={GRAY} />
      <ellipse cx="24" cy="32" rx="8.2" ry="6.6" fill="#e9ecea" />
      <ellipse cx="24" cy="29.6" rx="3" ry="2.2" fill={INK_DEEP} />
      <path d="M24 31.6V34.2" stroke={INK_DEEP} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="16.6" cy="22.6" r="1.9" fill={INK_DEEP} />
      <circle cx="31.4" cy="22.6" r="1.9" fill={INK_DEEP} />
    </>
  ),
  owl: (
    <>
      <path d="M9 8L17 14.5Q24 12 31 14.5L39 8L39.5 26Q39.5 41.5 24 41.5Q8.5 41.5 8.5 26Z" fill={MINT} />
      <circle cx="17.5" cy="24" r="7" fill="#f1f9f5" stroke="#b7c3c0" strokeWidth="1" />
      <circle cx="30.5" cy="24" r="7" fill="#f1f9f5" stroke="#b7c3c0" strokeWidth="1" />
      <circle cx="17.5" cy="24" r="3.1" fill={INK} />
      <circle cx="30.5" cy="24" r="3.1" fill={INK} />
      <circle cx="18.6" cy="22.9" r="1" fill="#ffffff" />
      <circle cx="31.6" cy="22.9" r="1" fill="#ffffff" />
      <path d="M22 30.2H26L24 33.8Z" fill="#69716f" />
    </>
  ),
  frog: (
    <>
      <circle cx="14" cy="15" r="7.5" fill={MINT} />
      <circle cx="34" cy="15" r="7.5" fill={MINT} />
      <ellipse cx="24" cy="28.5" rx="19.5" ry="12.5" fill={MINT} />
      <circle cx="14" cy="15" r="4.2" fill="#f1f9f5" />
      <circle cx="34" cy="15" r="4.2" fill="#f1f9f5" />
      <circle cx="14" cy="15.6" r="2.2" fill={INK} />
      <circle cx="34" cy="15.6" r="2.2" fill={INK} />
      <path d="M13 30.5Q24 37 35 30.5" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="10.5" cy="29" r="2" fill="#b4e4cf" />
      <circle cx="37.5" cy="29" r="2" fill="#b4e4cf" />
    </>
  ),
  cat: (
    <>
      <path d="M8.5 7L17.5 14.5Q24 12.8 30.5 14.5L39.5 7L40 26Q40 41 24 41Q8 41 8 26Z" fill="#c9d6d2" />
      <path d="M11 11.5L16 15.6L11.4 19.5ZM37 11.5L32 15.6L36.6 19.5Z" fill="#aebfb9" />
      <ellipse cx="17.5" cy="25.5" rx="2" ry="2.7" fill={INK} />
      <ellipse cx="30.5" cy="25.5" rx="2" ry="2.7" fill={INK} />
      <path d="M22.4 30.2H25.6L24 32.2Z" fill={INK} />
      <path d="M24 32.2Q22.6 34.6 20.6 33.6M24 32.2Q25.4 34.6 27.4 33.6" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M5.5 28.5H13.5M5.8 32.4L13.5 31M42.5 28.5H34.5M42.2 32.4L34.5 31" stroke="#9fb0ab" strokeWidth="0.9" strokeLinecap="round" />
    </>
  ),
};

function AnimalIcon({ kind }: { kind: AnimalKind }): ReactElement {
  return (
    <svg className="jn-icon" viewBox="0 0 48 48" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

function RibbonLines({ circles, className }: { circles: Circle[]; className: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 544 544">
      {circles.map((c, i) => (
        <circle key={i} className={i % 3 === 1 ? 'jn-m' : undefined} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}

/* ─── Helpers ─── */

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const motion = (duration: number, delay: number): CSSProperties =>
  ({ '--jn-dur': `${duration}s`, '--jn-delay': `${delay}s` }) as CSSProperties;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

/* ─── Component ─── */

export function JoinScreen({
  onJoin,
  participants = DEFAULT_PARTICIPANTS,
  label = 'Just your name',
  placeholder = 'Enter Your Name',
  buttonLabel = 'Join',
  maxLength = 32,
  animated = true,
  depthOfField = true,
  className,
  style,
  value,
  onValueChange,
  note,
  blocked = false,
  renderAvatar,
}: JoinScreenProps): ReactElement {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [joining, setJoining] = useState(false);

  // Fit the stage to the container; never shrink the form below a usable size on phones.
  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const contain = Math.min(w / STAGE_W, h / STAGE_H);
      const minimum = Math.min(w / 620, h / 720, 0.62);
      setScale(Math.min(Math.max(contain, minimum), 1.5));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // LOCAL: controlled when the host passes a value, its own otherwise
  const shown = value === undefined ? name : value;

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (joining) return;
    const trimmed = shown.trim();
    if (!trimmed || blocked) {
      setTouched(true);
      setShaking(true);
      inputRef.current?.focus();
      return;
    }
    const result: unknown = onJoin?.(trimmed);
    if (!isPromiseLike(result)) return;
    setJoining(true);
    try {
      await result;
    } finally {
      setJoining(false);
    }
  };

  const invalid = touched && shown.trim() === '';
  const placed = SLOTS.flatMap((slot, i) => {
    const person = participants[i];
    return person ? [{ slot, person, i }] : [];
  });
  const rootClass = ['jn-root', animated ? 'jn-animated' : '', className ?? ''].filter(Boolean).join(' ');
  const inputId = `${uid}-name`;
  const shadowId = `${uid}-shadow`;
  const cutId = `${uid}-cut`;
  const edgeId = `${uid}-edge`;

  return (
    <div ref={rootRef} className={rootClass} style={style}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="jn-stage" style={{ '--jn-scale': scale } as CSSProperties}>
        <div className="jn-decor" aria-hidden="true">
          <div className="jn-dots" />
          <svg className="jn-links" viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
            {LINKS.map(([x1, y1, x2, y2]) => (
              <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </svg>
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="jn-particle"
              style={{
                left: p.x - p.size / 2,
                top: p.y - p.size / 2,
                width: p.size,
                height: p.size,
                filter: p.blur ? `blur(${p.blur}px)` : undefined,
                ...motion(10 + i * 1.3, -i * 2.1),
              }}
            />
          ))}
          {placed.map(({ slot, person, i }) => {
            const blur = depthOfField ? slot.blur : 0;
            return (
              <div
                key={`${person.name}-${i}`}
                className="jn-avatar"
                style={{
                  left: slot.x - 45,
                  top: slot.y - 45,
                  opacity: depthOfField ? slot.opacity : 1,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  ...motion(8 + (i % 4) * 1.4, -i * 1.9),
                }}
              >
                {/* LOCAL: the app's own sprite sheet, when it hands one over */}
                {renderAvatar ? (
                  renderAvatar(person)
                ) : (
                  <div className="jn-avatar-disc">
                    <AnimalIcon kind={person.animal ?? 'fox'} />
                  </div>
                )}
                <span className="jn-avatar-name">{person.name}</span>
              </div>
            );
          })}
          <div className="jn-orb" />
          <div className="jn-orb-ring" />
          <div className="jn-orb-core" />
          <div className="jn-ribbons">
            <svg className="jn-band jn-mask-a" viewBox="0 0 544 544">
              <path d={fanBand(FAN_TOP)} fillRule="evenodd" fill="rgba(114,200,165,0.34)" />
              <path d={fanBand(FAN_TOP, 215)} fillRule="evenodd" fill="rgba(104,194,158,0.3)" />
            </svg>
            <svg className="jn-band jn-mask-b" viewBox="0 0 544 544">
              <path d={fanBand(FAN_BOTTOM)} fillRule="evenodd" fill="rgba(114,200,165,0.26)" />
              <path d={fanBand(FAN_BOTTOM, 225, 262)} fillRule="evenodd" fill="rgba(104,194,158,0.26)" />
            </svg>
            <RibbonLines circles={RIBBON_TOP} className="jn-rib jn-mask-a" />
            <RibbonLines circles={RIBBON_BOTTOM} className="jn-rib jn-mask-b" />
            <RibbonLines circles={RIBBON_RIM} className="jn-rib jn-mask-c" />
            <svg className="jn-sparks" viewBox="0 0 544 544">
              {SPARKS.map(({ at: [x, y], r, glint }, i) =>
                glint ? (
                  <path key={i} className="jn-spark" d={starPath(x, y, r * 3.4)} style={motion(2.8 + (i % 5) * 0.6, -i * 0.7)} />
                ) : (
                  <circle key={i} className="jn-spark" cx={x} cy={y} r={r} style={motion(2.8 + (i % 5) * 0.6, -i * 0.7)} />
                ),
              )}
            </svg>
          </div>
        </div>

        <form className="jn-card" noValidate onSubmit={(e) => { void submit(e); }}>
          <svg className="jn-card-shadow" viewBox="0 0 583 492" aria-hidden="true">
            <defs>
              <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="14" />
              </filter>
              <mask id={cutId} maskUnits="userSpaceOnUse" x="0" y="0" width="583" height="492">
                <rect width="583" height="492" fill="#ffffff" />
                <path d={CARD_PATH} transform="translate(60 60)" fill="#000000" />
              </mask>
            </defs>
            <g mask={`url(#${cutId})`}>
              <path d={CARD_PATH} transform="translate(60 78)" fill="rgba(64,146,114,0.3)" filter={`url(#${shadowId})`} />
            </g>
          </svg>
          <div className="jn-card-glass" aria-hidden="true" />
          <svg className="jn-card-edge" viewBox="0 0 463 372" aria-hidden="true">
            <defs>
              <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="1" stopColor={MINT} stopOpacity="0.75" />
              </linearGradient>
            </defs>
            <path d={CARD_PATH} fill="none" stroke={`url(#${edgeId})`} strokeWidth="1.5" />
          </svg>

          <label className="jn-label" htmlFor={inputId}>
            {label}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className={shaking ? 'jn-input jn-shake' : 'jn-input'}
            type="text"
            name="name"
            value={shown}
            placeholder={placeholder}
            maxLength={maxLength}
            autoComplete="nickname"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="go"
            readOnly={joining}
            aria-invalid={invalid || undefined}
            onChange={(e) => (onValueChange ? onValueChange(e.target.value) : setName(e.target.value))}
            onAnimationEnd={() => setShaking(false)}
          />

          {/* LOCAL: the line the app writes under the box */}
          {note ? <p className="jn-note">{note}</p> : null}

          <div className="jn-ring" aria-hidden="true" />
          <button type="submit" className="jn-join" disabled={joining} aria-busy={joining || undefined}>
            {joining ? <span className="jn-spinner" aria-hidden="true" /> : buttonLabel}
            {joining ? <span className="jn-sr">Joining</span> : null}
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinScreen;

/* ─── Styles ─── */

const CSS = `
.jn-root{position:relative;z-index:0;width:100%;min-height:100vh;min-height:100dvh;overflow:hidden;font-family:var(--jn-font,'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);color:#27302e;background:radial-gradient(ellipse 80% 70% at 50% 46%,#fbfcfc 0%,#f6f8f7 58%,#edf0ef 100%);-webkit-font-smoothing:antialiased}
.jn-root *,.jn-root *::before,.jn-root *::after{box-sizing:border-box}
.jn-stage{position:absolute;left:50%;top:50%;width:1600px;height:872px;margin:-436px 0 0 -800px;transform:scale(var(--jn-scale,1));transform-origin:50% 50%}
.jn-decor{position:absolute;inset:0;pointer-events:none;user-select:none}
.jn-dots{position:absolute;left:360px;top:40px;width:880px;height:800px;background-image:radial-gradient(circle,rgba(134,146,143,.55) 1.4px,transparent 1.9px);background-size:40px 40px;-webkit-mask-image:radial-gradient(closest-side,#000 55%,transparent 100%);mask-image:radial-gradient(closest-side,#000 55%,transparent 100%)}
.jn-links{position:absolute;left:0;top:0;width:1600px;height:872px;overflow:visible}
.jn-links line{stroke:rgba(146,160,156,.3);stroke-width:1;stroke-linecap:round}
.jn-particle{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(104,210,166,.95) 0%,rgba(120,214,174,.55) 42%,rgba(140,220,186,0) 72%)}
.jn-avatar{position:absolute;width:90px;height:90px}
.jn-avatar-disc{width:90px;height:90px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 38% 30%,#fff 0%,#f8fbfa 46%,#eaf5f0 100%);box-shadow:0 16px 30px -10px rgba(58,98,84,.22),0 3px 8px rgba(58,98,84,.06),inset 0 -8px 16px rgba(143,211,182,.22),inset 0 1px 2px #fff}
.jn-icon{width:48px;height:48px;display:block}
.jn-avatar-name{position:absolute;left:50%;top:104px;transform:translateX(-50%);white-space:nowrap;font-size:calc(12px / var(--jn-scale,1));line-height:1.4;font-weight:500;letter-spacing:.05em;color:#98a4a1}
.jn-orb,.jn-ribbons{position:absolute;left:528px;top:177px;width:544px;height:544px;border-radius:50%}
.jn-orb{background:radial-gradient(circle at 60% 36%,rgba(255,255,255,0) 52%,rgba(168,226,201,.5) 78%,rgba(122,206,171,.85) 100%),linear-gradient(160deg,rgba(232,247,240,.7),rgba(200,236,220,.7));-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.75),inset 0 0 0 5px rgba(170,228,203,.35),inset 12px -16px 30px rgba(108,200,162,.45),inset -10px 14px 26px rgba(255,255,255,.7),0 40px 70px -24px rgba(74,180,138,.65),0 0 60px rgba(134,214,180,.42)}
.jn-orb-ring{position:absolute;left:550px;top:199px;width:500px;height:500px;border-radius:50%;border:1.5px solid rgba(255,255,255,.78);box-shadow:0 0 0 1px rgba(138,212,181,.18),inset 0 0 18px rgba(255,255,255,.35)}
.jn-orb-core{position:absolute;left:576px;top:225px;width:448px;height:448px;border-radius:50%;background:radial-gradient(circle at 40% 24%,rgba(255,255,255,.97) 0%,rgba(246,251,249,.9) 40%,rgba(208,239,225,.86) 100%);box-shadow:0 0 0 1.5px rgba(255,255,255,.88),0 12px 30px rgba(102,190,154,.24),inset 0 -22px 40px rgba(138,212,181,.34)}
.jn-ribbons{overflow:hidden}
.jn-ribbons svg{position:absolute;left:0;top:0;width:544px;height:544px;overflow:visible}
.jn-rib circle{fill:none;stroke:rgba(255,255,255,.9);stroke-width:.8}
.jn-rib .jn-m{stroke:rgba(92,186,148,.62)}
.jn-band{filter:blur(3.5px)}
.jn-mask-a{-webkit-mask-image:conic-gradient(from -30deg at 55.1% 53.1%,transparent 0deg,#000 20deg,#000 135deg,transparent 175deg);mask-image:conic-gradient(from -30deg at 55.1% 53.1%,transparent 0deg,#000 20deg,#000 135deg,transparent 175deg)}
.jn-mask-b{-webkit-mask-image:conic-gradient(from 140deg at 45.4% 36.8%,transparent 0deg,#000 25deg,#000 115deg,transparent 150deg);mask-image:conic-gradient(from 140deg at 45.4% 36.8%,transparent 0deg,#000 25deg,#000 115deg,transparent 150deg)}
.jn-mask-c{-webkit-mask-image:conic-gradient(from 20deg,transparent 0deg,#000 40deg,#000 100deg,transparent 140deg);mask-image:conic-gradient(from 20deg,transparent 0deg,#000 40deg,#000 100deg,transparent 140deg)}
.jn-sparks{filter:drop-shadow(0 0 3px rgba(255,255,255,.95))}
.jn-spark{fill:#fff}
.jn-card{position:absolute;left:565px;top:266px;width:463px;height:372px;margin:0}
.jn-card-shadow{position:absolute;left:-60px;top:-60px;width:583px;height:492px;overflow:visible;pointer-events:none}
.jn-card-glass{position:absolute;left:0;top:0;width:463px;height:372px;clip-path:path('${CARD_PATH}');background:linear-gradient(172deg,rgba(255,255,255,.8) 0%,rgba(248,251,250,.66) 48%,rgba(231,244,238,.62) 100%);-webkit-backdrop-filter:blur(16px) saturate(1.25);backdrop-filter:blur(16px) saturate(1.25)}
.jn-card-edge{position:absolute;left:0;top:0;width:463px;height:372px;overflow:visible;pointer-events:none}
.jn-label{position:absolute;left:63px;top:91px;height:28px;display:flex;align-items:flex-end;margin:0;font-size:calc(11.5px / var(--jn-scale,1));line-height:1.3;font-weight:400;letter-spacing:.1em;text-transform:uppercase;color:#8b9794;white-space:nowrap;user-select:none}
.jn-input{position:absolute;left:45px;top:130px;width:387px;height:81px;margin:0;padding:0 28px;border-radius:28px;border:2px solid #9bd9be;outline:none;-webkit-appearance:none;appearance:none;font:inherit;font-size:calc(13px / var(--jn-scale,1));font-weight:400;letter-spacing:.02em;color:#27302e;background:linear-gradient(180deg,#eef2f1 0%,#f8faf9 38%,#fbfcfc 70%,#f3f7f5 100%);box-shadow:inset 0 3px 7px rgba(72,98,90,.14),inset 0 0 0 2px rgba(255,255,255,.75),0 0 0 3px rgba(255,255,255,.55),0 12px 24px -8px rgba(76,184,141,.6);transition:border-color .2s,box-shadow .2s}
.jn-input::placeholder{color:#56605d;opacity:1}
.jn-input:focus{border-color:#86d2b1;box-shadow:inset 0 3px 7px rgba(72,98,90,.12),inset 0 0 0 2px rgba(255,255,255,.75),0 0 0 5px rgba(143,214,184,.3),0 12px 24px -8px rgba(80,186,144,.6)}
.jn-input:focus::placeholder{color:#9ba5a2}
.jn-note{position:absolute;left:63px;top:216px;width:250px;margin:0;font-size:calc(11.5px / var(--jn-scale,1));line-height:1.35;letter-spacing:.02em;color:#7f8b88}
.jn-shake{animation:jn-shake .42s cubic-bezier(.36,.07,.19,.97)}
.jn-ring{position:absolute;left:313px;top:222px;width:150px;height:150px;border-radius:50%;pointer-events:none;background:radial-gradient(circle at 50% 30%,rgba(255,255,255,.9) 0%,rgba(240,249,245,.72) 55%,rgba(206,238,224,.78) 100%);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.92),inset 0 -10px 18px rgba(124,203,168,.34),0 14px 30px -6px rgba(70,160,124,.32)}
.jn-join{position:absolute;left:334px;top:243px;width:108px;height:108px;margin:0;padding:0;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;font:inherit;font-size:calc(13px / var(--jn-scale,1));font-weight:500;letter-spacing:.06em;color:#1f2a27;background:radial-gradient(circle at 50% 28%,#aee6cf 0%,#93d8bb 52%,#7fcdab 100%);box-shadow:0 12px 18px -6px rgba(34,84,64,.5),0 4px 8px rgba(34,84,64,.18),inset 0 2px 3px rgba(255,255,255,.6),inset 0 -5px 10px rgba(58,140,104,.32);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;-webkit-tap-highlight-color:transparent}
.jn-join:hover{transform:translateY(-2px);filter:brightness(1.03) saturate(1.06);box-shadow:0 16px 22px -6px rgba(34,84,64,.5),0 5px 10px rgba(34,84,64,.18),inset 0 2px 3px rgba(255,255,255,.6),inset 0 -5px 10px rgba(58,140,104,.32)}
.jn-join:active{transform:translateY(1px) scale(.98);box-shadow:0 6px 10px -4px rgba(34,84,64,.5),0 2px 4px rgba(34,84,64,.18),inset 0 2px 3px rgba(255,255,255,.5),inset 0 -3px 8px rgba(58,140,104,.32)}
.jn-join:focus-visible{outline:none;box-shadow:0 0 0 4px rgba(255,255,255,.95),0 0 0 7px rgba(111,198,162,.6),0 12px 18px -6px rgba(34,84,64,.5)}
.jn-join:disabled{cursor:progress;transform:none;filter:none}
.jn-spinner{width:30px;height:30px;border-radius:50%;border:3px solid rgba(31,42,39,.18);border-top-color:#1f2a27;animation:jn-spin .8s linear infinite}
.jn-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.jn-animated .jn-avatar{animation:jn-float var(--jn-dur,9s) ease-in-out var(--jn-delay,0s) infinite}
.jn-animated .jn-particle{animation:jn-drift var(--jn-dur,11s) ease-in-out var(--jn-delay,0s) infinite}
.jn-animated .jn-ribbons{animation:jn-sway 18s ease-in-out infinite alternate}
.jn-animated .jn-spark{animation:jn-twinkle var(--jn-dur,3.6s) ease-in-out var(--jn-delay,0s) infinite}
@keyframes jn-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-7px,0)}}
@keyframes jn-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(6px,-9px,0)}}
@keyframes jn-sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
@keyframes jn-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes jn-spin{to{transform:rotate(360deg)}}
@keyframes jn-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-5px)}40%,60%{transform:translateX(5px)}}
@media (prefers-reduced-motion:reduce){.jn-animated .jn-avatar,.jn-animated .jn-particle,.jn-animated .jn-ribbons,.jn-animated .jn-spark{animation:none}}
`;
