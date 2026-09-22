import type { CSSProperties } from 'react';
import sheet from '../assets/animals.webp';
import { SHEET_COLS, SHEET_ROWS, tileOf } from '../lib/animals.ts';
import { color, ring } from './theme.ts';

// Rings, not borders, define state.
//   rest    someone who is here
//   you     you
//   hot     the one being held under the cursor
//   picked  ticked for a group  (GAP: style.md has no fourth ring)
//   offline someone whose socket has gone  (GAP: nor a treatment for this)
export type AvatarState = 'rest' | 'you' | 'hot' | 'picked' | 'offline';

export function Avatar({
  id,
  px = 56,
  state = 'rest',
  pinging = false,
  style,
}: {
  id: string;
  px?: number;
  state?: AvatarState;
  pinging?: boolean;
  style?: CSSProperties;
}) {
  const tile = tileOf(id);
  const col = tile % SHEET_COLS;
  const row = Math.floor(tile / SHEET_COLS);
  const shadow = state === 'offline' ? ring.rest : ring[state];

  return (
    <div style={{ position: 'relative', width: px, height: px, ...style }}>
      {/* Arrival only: two mint rings, the second half a beat behind. Four
          rings and it stops — walking in is a moment, not a state, and an
          infinite ping would make every page twitch forever. */}
      {pinging
        ? ['0s', '.8s'].map((delay) => (
            <div
              key={delay}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `1px solid ${color.mint}`,
                pointerEvents: 'none',
                animation: 'ping 1.6s ease-out 4',
                animationDelay: delay,
              }}
            />
          ))
        : null}
      <div
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          backgroundImage: `url(${sheet})`,
          backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
          backgroundPosition: `${(col * 100) / (SHEET_COLS - 1)}% ${(row * 100) / (SHEET_ROWS - 1)}%`,
          boxShadow: shadow,
          // someone who has gone quiet is still here, just further away
          opacity: state === 'offline' ? 0.5 : 1,
          transition: 'box-shadow .3s ease, opacity .3s ease',
        }}
      />
    </div>
  );
}

// Two or three faces overlapped, to stand for a group in a list.
export function AvatarStack({ ids, px = 26 }: { ids: string[]; px?: number }) {
  const shown = ids.slice(0, 3);
  return (
    <div style={{ display: 'flex', flex: '0 0 auto' }}>
      {shown.map((id, i) => (
        <div key={id} style={{ marginLeft: i === 0 ? 0 : -px * 0.38, zIndex: shown.length - i }}>
          <Avatar id={id} px={px} />
        </div>
      ))}
    </div>
  );
}
