import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import NameInput from '../components/NameInput.tsx';
import RouteStrip from '../components/RouteStrip.tsx';
import useNameCheck from '../hooks/useNameCheck';
import { animalOf } from '../lib/animals.ts';
import { useRealtime } from '../realtime/context.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Bar, Button, Label, Page, Panel, PanelHeader, Stage } from '../ui/primitives.tsx';
import { chooseScheme, currentScheme, type Scheme } from '../ui/scheme.ts';
import { color, type } from '../ui/theme.ts';

const SCHEMES: { scheme: Scheme; label: string }[] = [
  { scheme: 'system', label: 'SYSTEM' },
  { scheme: 'light', label: 'LIGHT' },
  { scheme: 'dark', label: 'DARK' },
];

// Your own name, how this device shows the page, and the way out.
export default function YouPage() {
  const { isConnected, joinedName, myId, rename, disconnect } = useRealtime();
  const { name, changeName, nameError, status } = useNameCheck(joinedName);
  // read from the page itself, which already shows the saved choice
  const [scheme, setScheme] = useState(currentScheme);

  function pickScheme(next: Scheme) {
    chooseScheme(next);
    setScheme(next);
  }

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  // the name check counts us as holding our own name, so changing only its case
  // always reads as "unavailable". The server allows it, since it skips us by id.
  const isOwnName = name.trim().toLowerCase() === joinedName.toLowerCase();
  // Something to rename to: valid, actually different, and not already known to
  // be someone else's. A name still being checked can be saved, as on the join
  // page: the server checks again and says why if it refuses.
  const canRename =
    nameError === null && name.trim() !== joinedName && (isOwnName || status !== 'unavailable');

  return (
    // Fills the window like /people, with the same cap, so moving between the
    // two doesn't change the panel's height.
    <Page style={{ minHeight: 'min(100dvh, 860px)' }}>
      <RouteStrip />

      <Panel style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        <PanelHeader
          route="/you"
          meta="this device, on this network"
          hint="THE ANIMAL COMES FROM YOUR ID"
        />

        {/* takes the room the name box leaves, down to just enough for you */}
        <Stage style={{ flex: '1 1 auto', minHeight: 170, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', animation: 'reveal .22s ease-out backwards' }}>
            <Avatar id={myId} px={84} state="you" style={{ margin: '0 auto' }} />
            <div style={{ ...type.name, color: color.you, marginTop: 12, fontSize: 13 }}>
              {joinedName}
            </div>
            <Label style={{ marginTop: 6 }}>THE {animalOf(myId).toUpperCase()}</Label>
          </div>
        </Stage>

        <Bar style={{ marginTop: 16 }}>
          <Label>DISPLAY NAME</Label>
          {/* no wrapping: on a phone the box narrows and SAVE stays beside it */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8 }}>
            {/* no hint, so the line under the box is empty until there's a
                broken rule or an answer from the server to show */}
            <NameInput
              value={name}
              onChange={changeName}
              error={nameError}
              // the check counts us as holding our own name, so it would say
              // "unavailable" about the name we are already called
              status={isOwnName ? '' : status}
              onEnter={() => canRename && rename(name.trim())}
            />
            <Button onClick={() => rename(name.trim())} disabled={!canRename}>
              SAVE
            </Button>
          </div>
        </Bar>

        {/* on a phone the two halves wrap, and DISCONNECT keeps to the right */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <div role="group" aria-label="light or dark" style={{ display: 'flex', gap: 6 }}>
            {SCHEMES.map((option) => (
              <Button
                key={option.scheme}
                kind={option.scheme === scheme ? 'primary' : 'quiet'}
                pressed={option.scheme === scheme}
                onClick={() => pickScheme(option.scheme)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button kind="quiet" onClick={disconnect} style={{ marginLeft: 'auto' }}>
            DISCONNECT
          </Button>
        </div>
      </Panel>
    </Page>
  );
}
