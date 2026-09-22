import { resolveValue, useToaster } from 'react-hot-toast/headless';
import { color, radius, type } from '../ui/theme.ts';

// Everything the server refused, shown wherever you happen to be standing.
//
// Headless on purpose: react-hot-toast keeps the queue and the dismiss timers,
// and we do all of the rendering.
//
// GAP: style.md has one accent and no red, so a refusal cannot be coloured like
// one. It is a sheet of paper with a mint dot, and it says what happened. That
// turns out to be enough — but the guide should say so, or every page will
// reach for a red that isn't in the palette.
export default function Notices() {
  const { toasts, handlers } = useToaster();
  const visible = toasts.filter((notice) => notice.visible);

  return (
    <div
      // hovering holds a message open, so a long reason isn't snatched away mid-read
      onMouseEnter={handlers.startPause}
      onMouseLeave={handlers.endPause}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        padding: '0 16px',
      }}
    >
      {visible.map((notice) => (
        <div
          key={notice.id}
          role="alert"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: 420,
            background: color.paper,
            border: `1px solid ${color.hair}`,
            borderRadius: radius.bar,
            padding: '11px 14px',
            boxShadow: '0 1px 2px rgba(31,58,48,.04), 0 18px 40px -28px rgba(31,58,48,.28)',
            animation: 'reveal .22s ease-out backwards',
          }}
        >
          <span
            style={{
              flex: '0 0 auto',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: color.mintDeep,
            }}
          />
          <span style={{ ...type.body, fontSize: 12 }}>{resolveValue(notice.message, notice)}</span>
        </div>
      ))}
    </div>
  );
}
