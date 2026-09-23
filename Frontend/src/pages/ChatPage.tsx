import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import ChatList from '../components/ChatList.tsx';
import Conversation from '../components/Conversation.tsx';
import GroupMembers from '../components/GroupMembers.tsx';
import RouteStrip from '../components/RouteStrip.tsx';
import { chatMeta, chatTitle } from '../lib/chats.ts';
import { useRealtime } from '../realtime/context.ts';
import { useNarrow } from '../ui/hooks.ts';
import { Button, Label, Page, Panel, PanelHeader, Stage } from '../ui/primitives.tsx';
import { size } from '../ui/theme.ts';

// A panel stacked top to bottom, whose middle grows into whatever height is
// left: header, then a stage that scrolls, then a bar.
const column = { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' } as const;

// Your chats, and whichever one is open.
export default function ChatPage() {
  const {
    isConnected, myId, users, chats, messages, unread, openChatId,
    selectChat, sendMessage, addMember, removeMember,
  } = useRealtime();
  const navigate = useNavigate();
  const narrow = useNarrow();
  // The group whose members are showing in place of its conversation. Held as
  // the group's id rather than a flag, so no other chat can open on its members.
  const [membersOf, setMembersOf] = useState('');

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  const openChat = chats.find((chat) => chat.id === openChatId);
  const openMessages = messages[openChatId] ?? [];
  const showMembers = openChat?.type === 'group' && membersOf === openChat.id;

  // picking a chat, or going back to the list, always lands on what was said
  function open(chatId: string) {
    selectChat(chatId);
    setMembersOf('');
  }

  const list = (
    <Panel style={{ ...column, flex: narrow ? '1 1 auto' : '0 0 320px' }}>
      <PanelHeader
        route="/chat"
        meta={`${chats.length} ${chats.length === 1 ? 'chat' : 'chats'} open`}
        hint={narrow ? undefined : 'CLICK TO OPEN'}
      />
      {chats.length === 0 ? (
        <Stage height={200} style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
          <Label style={{ textAlign: 'center', lineHeight: 1.7 }}>
            NO CHATS YET
            <br />
            PICK SOMEONE ON /people
          </Label>
        </Stage>
      ) : (
        // a long list scrolls inside the panel rather than making the page longer
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
          <ChatList
            chats={chats}
            myId={myId}
            unread={unread}
            openChatId={openChatId}
            onSelect={open}
          />
        </div>
      )}
    </Panel>
  );

  // A group's members are one press away rather than always on show: you read
  // a group far more often than you change who's in it.
  const membersButton = openChat?.type === 'group' ? (
    <Button kind="quiet" onClick={() => setMembersOf(showMembers ? '' : openChat.id)}>
      {showMembers ? 'DONE' : 'MEMBERS'}
    </Button>
  ) : null;

  const conversation = openChat ? (
    <Panel style={column}>
      {/* on a phone the members button shares the back button's row, rather
          than taking a line of its own under the title */}
      {narrow ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <Button kind="quiet" onClick={() => open('')}>
            ← ALL CHATS
          </Button>
          {membersButton}
        </div>
      ) : null}
      <PanelHeader
        route={chatTitle(openChat, myId)}
        meta={chatMeta(openChat, myId)}
        hint={membersButton ? (narrow ? undefined : membersButton) : 'ENTER TO SEND'}
      />
      {showMembers ? (
        <GroupMembers
          chat={openChat}
          myId={myId}
          users={users}
          onAdd={(userId) => addMember(openChat.id, userId)}
          onRemove={(userId) => removeMember(openChat.id, userId)}
        />
      ) : (
        <Conversation
          chat={openChat}
          myId={myId}
          messages={openMessages}
          onSend={(text) => sendMessage(openChat.id, text)}
        />
      )}
    </Panel>
  ) : (
    <Panel style={column}>
      <PanelHeader route="/chat" meta="nothing open" hint="PICK ONE ON THE LEFT" />
      <Stage style={{ flex: '1 1 0', minHeight: 200, display: 'grid', placeItems: 'center' }}>
        <Label>NOTHING OPEN</Label>
      </Stage>
      <div style={{ marginTop: 16 }}>
        <Button kind="quiet" onClick={() => navigate('/people')}>
          AROUND YOU
        </Button>
      </div>
    </Panel>
  );

  // The page is at least as tall as the window and the panels grow to fill it,
  // so more messages, more members or more chats scroll inside their panel
  // instead of making the page longer.
  //
  // On a phone there is only room for one of the two, so the open chat wins.
  if (narrow) {
    return (
      <Page style={{ minHeight: '100dvh' }}>
        <RouteStrip />
        {openChat ? conversation : list}
      </Page>
    );
  }

  return (
    <Page style={{ minHeight: '100dvh' }}>
      <RouteStrip />
      <div style={{ flex: '1 1 auto', display: 'flex', gap: size.panelGap }}>
        {list}
        {conversation}
      </div>
    </Page>
  );
}
