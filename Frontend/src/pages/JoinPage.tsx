import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JoinScreen from '../components/JoinScreen.tsx';
import useNameCheck from '../hooks/useNameCheck';
import { FAKE } from '../lib/mode.ts';
import { nameNote } from '../lib/names.ts';
import { useRealtime } from '../realtime/context.ts';
import { revealStyle } from '../ui/motion.ts';
import { Label } from '../ui/primitives.tsx';
import { color, radius, type } from '../ui/theme.ts';

// The door is the JoinScreen artwork exactly as it was designed — its faces,
// its cast, its words — and this page hands it only what it cannot know: what
// the name rules are, and what to do when a name passes them.
//
// The faces are scenery. They are the one thing in this app that is not
// somebody on the wi-fi; past this screen every name and face is real.
//
// Anything else appears only when there is something to say: the rule you are
// breaking, or why the server shut the door. Standing still, this is the design.
export default function JoinPage() {
  const { isConnected, closeReason, connect } = useRealtime();
  const { name, changeName, nameError, status, ready } = useNameCheck();
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected) {
      navigate('/people');
    }
  }, [isConnected, navigate]);

  const canConnect = nameError === null && ready;
  const note = nameNote(name, nameError, status);

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <JoinScreen
        value={name}
        onValueChange={changeName}
        onJoin={() => connect(name.trim())}
        // a name the server would refuse shakes the box instead of joining
        blocked={!canConnect}
        // only ever the rule being broken. A name the server is happy with
        // leaves the card exactly as it was drawn.
        note={note.problem ? <span style={{ color: color.ink }}>{note.line}</span> : null}
      />

      {/* A refused join closes the socket, and this is the only place that says
          why: 4002 for a broken rule, 4001 for a name already taken. Nothing is
          drawn here until there is a reason to draw it. */}
      {closeReason || FAKE ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '0 20px',
            textAlign: 'center',
          }}
        >
          {closeReason ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                background: color.paper,
                border: `1px solid ${color.hair}`,
                borderRadius: radius.bar,
                ...revealStyle(0),
              }}
            >
              <span
                style={{ width: 6, height: 6, borderRadius: '50%', background: color.mintDeep, flex: '0 0 auto' }}
              />
              <span style={{ ...type.body, fontSize: 12 }}>{closeReason}</span>
            </div>
          ) : null}

          {/* faking is sticky for the tab, so it has to say so. Never in the
              real app, where the door is left alone. */}
          {FAKE ? <Label>FAKE SERVER · NOBODY HERE IS REAL · ?fake=0 TO LEAVE</Label> : null}
        </div>
      ) : null}
    </div>
  );
}
