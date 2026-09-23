import { Navigate } from 'react-router-dom';
import NameInput from '../components/NameInput.tsx';
import RouteStrip from '../components/RouteStrip.tsx';
import useNameCheck from '../hooks/useNameCheck';
import { animalOf } from '../lib/animals.ts';
import { useRealtime } from '../realtime/context.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { Bar, Button, Label, Page, Panel, PanelHeader, Stage } from '../ui/primitives.tsx';
import { color, type } from '../ui/theme.ts';

// Your own name, and the way out.
export default function YouPage() {
  const { isConnected, joinedName, myId, rename, disconnect } = useRealtime();
  const { name, changeName, nameError, status, ready } = useNameCheck(joinedName);

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  // the name check counts us as holding our own name, so changing only its case
  // always reads as "unavailable". The server allows it, since it skips us by id.
  const isOwnName = name.trim().toLowerCase() === joinedName.toLowerCase();
  // nothing to rename to unless the name is valid, free, and actually different
  const canRename = nameError === null && name.trim() !== joinedName && (ready || isOwnName);

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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Button kind="quiet" onClick={disconnect}>
            DISCONNECT
          </Button>
        </div>
      </Panel>
    </Page>
  );
}
