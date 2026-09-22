import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NameInput from '../components/NameInput.tsx';
import useNameCheck from '../hooks/useNameCheck';
import { FAKE } from '../lib/mode.ts';
import { useRealtime } from '../realtime/context.ts';
import { Bar, Button, Label, Page, Panel, PanelHeader } from '../ui/primitives.tsx';
import { color, radius, type } from '../ui/theme.ts';

// Pick a name and connect. Once the socket is open, move on to the people page.
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

  return (
    <Page>
      <Panel style={{ marginTop: 40 }}>
        {/* GAP: style.md's "route name on top" has no answer for "/", and a
            lone slash reads as a typo. The front door says its name instead. */}
        <PanelHeader
          route="localnetchat"
          meta="one wi-fi, one room. no accounts, and nothing is kept."
          hint="4–20 CHARACTERS · ONE DIGIT · NO SPACES"
        />

        <Bar style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <NameInput
            value={name}
            onChange={changeName}
            error={nameError}
            status={status}
            autoFocus
            onEnter={() => canConnect && connect(name.trim())}
          />
          <Button onClick={() => connect(name.trim())} disabled={!canConnect} style={{ marginTop: 0 }}>
            CONNECT
          </Button>
        </Bar>

        {/* a refused join closes the socket, and this is the only place that
            says why: 4002 for a broken rule, 4001 for a name already taken */}
        {closeReason ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 14,
              padding: '11px 14px',
              background: color.paper,
              border: `1px solid ${color.hair}`,
              borderRadius: radius.bar,
              animation: 'reveal .22s ease-out backwards',
            }}
          >
            <span
              style={{ width: 6, height: 6, borderRadius: '50%', background: color.mintDeep, flex: '0 0 auto' }}
            />
            <span style={{ ...type.body, fontSize: 12 }}>{closeReason}</span>
          </div>
        ) : null}

        <Label style={{ marginTop: 16 }}>
          THE NAME IS CHECKED HERE AS YOU TYPE, AND AGAIN BY THE SERVER
        </Label>
        {/* faking is sticky for the tab, so the page has to say when it's on */}
        {FAKE ? (
          <Label style={{ marginTop: 6 }}>FAKE SERVER · NOBODY HERE IS REAL · ?fake=0 TO LEAVE</Label>
        ) : null}
      </Panel>
    </Page>
  );
}
