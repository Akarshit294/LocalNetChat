import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PeopleField from '../components/PeopleField.tsx';
import RouteStrip from '../components/RouteStrip.tsx';
import { validateGroupName } from '../lib/validation.ts';
import { useRealtime } from '../realtime/context.ts';
import { useCanHover } from '../ui/hooks.ts';
import { Bar, Button, Field, Label, Page, Panel, PanelHeader, Stage } from '../ui/primitives.tsx';
import { color } from '../ui/theme.ts';

// Everyone on this network right now.
export default function PeoplePage() {
  const { isConnected, users, myId, arrivals, systemLine, openChat, createGroup } = useRealtime();
  const navigate = useNavigate();
  const canHover = useCanHover();
  // null while we're just looking. Making a group turns it into the picked ids,
  // so one piece of state says both "are we picking" and "who so far".
  const [picked, setPicked] = useState<string[] | null>(null);
  const [groupName, setGroupName] = useState('');

  // no connection, nothing to show: back to the join page
  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  const nameError = picked === null ? null : validateGroupName(groupName);
  const canCreate = picked !== null && picked.length > 0 && nameError === null;

  function messageThem(userId: string) {
    openChat(userId); // the server answers with the chat, and the provider opens it
    navigate('/chat');
  }

  function togglePicked(userId: string) {
    setPicked((before) => {
      if (before === null) {
        return before;
      }
      return before.includes(userId)
        ? before.filter((id) => id !== userId)
        : [...before, userId];
    });
  }

  function stopPicking() {
    setPicked(null);
    setGroupName('');
  }

  function makeGroup() {
    if (picked && canCreate) {
      // we don't send our own id: the server adds us from the socket
      createGroup(picked, groupName.trim());
      stopPicking();
      navigate('/chat');
    }
  }

  // what you can do to a person depends on what you're pointing with
  const lookingHint = canHover ? 'HOVER TO HOLD · CLICK TO MESSAGE' : 'TAP TO MESSAGE';

  return (
    // The page is at least as tall as the window, and the stage grows into
    // whatever the header and the row under it leave, so the page itself doesn't
    // scroll. The 860px cap keeps the stage near 560px on a tall screen; any
    // taller and the ring of people stretches into an oval.
    <Page style={{ minHeight: 'min(100dvh, 860px)' }}>
      <RouteStrip />

      <Panel style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        <PanelHeader
          route="/people"
          meta={`${users.length} ${users.length === 1 ? 'person' : 'people'} on this network`}
          hint={picked === null ? lookingHint : "TICK WHO'S IN IT"}
        />

        {/* below 300px it stops shrinking and the page scrolls instead: any
            smaller and the people have no room around you */}
        <Stage style={{ flex: '1 1 auto', minHeight: 300 }}>
          <PeopleField
            users={users}
            myId={myId}
            arrivals={arrivals}
            picked={picked}
            onToggle={togglePicked}
            onOpen={messageThem}
          />
        </Stage>

        {picked === null ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* the last thing the server told everyone. One line, and it is
                allowed to be empty. */}
            <Label style={{ flex: '1 1 auto' }} key={systemLine}>
              {systemLine ? systemLine.toUpperCase() : ''}
            </Label>
            {/* with nobody else here there is no group to make */}
            <Button kind="quiet" onClick={() => setPicked([])} disabled={users.length < 2}>
              NEW GROUP
            </Button>
          </div>
        ) : (
          <Bar style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Field
                value={groupName}
                onChange={setGroupName}
                placeholder="name the group..."
                maxLength={30}
                autoFocus
                ariaLabel="group name"
                onKeyDown={(event) => event.key === 'Enter' && makeGroup()}
              />
              <Button onClick={makeGroup} disabled={!canCreate}>
                CREATE{picked.length ? ` (${picked.length})` : ''}
              </Button>
              <Button kind="quiet" onClick={stopPicking}>
                CANCEL
              </Button>
            </div>
            {/* an empty box is where you start, so don't call it an error yet */}
            <Label style={{ marginTop: 10, color: groupName.trim() && nameError ? color.inkMuted : color.inkFaint }}>
              {groupName.trim() && nameError
                ? nameError.toUpperCase()
                : `${picked.length} PICKED · 1–30 CHARACTERS · NO SPACES`}
            </Label>
          </Bar>
        )}
      </Panel>
    </Page>
  );
}
