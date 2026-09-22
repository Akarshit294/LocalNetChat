import { Link, useLocation } from 'react-router-dom';
import { useRealtime } from '../realtime/context.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useNarrow } from '../ui/hooks.ts';
import { Chip } from '../ui/primitives.tsx';
import { color, font } from '../ui/theme.ts';

const ROUTES = ['/people', '/chat', '/you'];

// GAP: style.md says a panel's header is the whole chrome, and then has no
// answer for moving between pages. This is the smallest thing that works: the
// route names themselves, in mono, on the background — no bar, no box.
export default function RouteStrip() {
  const { pathname } = useLocation();
  const { unread, myId, joinedName } = useRealtime();
  const narrow = useNarrow();
  const waiting = Object.values(unread).reduce((total, count) => total + count, 0);

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        fontFamily: font.mono,
        fontSize: 12.5,
        letterSpacing: '.04em',
        marginBottom: narrow ? -8 : -16,
      }}
    >
      {ROUTES.map((route) => {
        const here = pathname === route;
        return (
          <Link
            key={route}
            to={route}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              textDecoration: 'none',
              color: here ? color.ink : color.inkFaint,
              fontWeight: here ? 600 : 400,
            }}
          >
            {route}
            {route === '/chat' && waiting ? <Chip>{waiting} NEW</Chip> : null}
          </Link>
        );
      })}

      <span style={{ flex: '1 1 auto' }} />

      {myId ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: color.you }}>
          <Avatar id={myId} px={22} state="rest" />
          {narrow ? null : joinedName}
        </span>
      ) : null}
    </nav>
  );
}
