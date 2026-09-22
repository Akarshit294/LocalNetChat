import { Navigate, useNavigate } from 'react-router-dom';
import ChatList from '../components/ChatList.tsx';
import Conversation from '../components/Conversation.tsx';
import RouteStrip from '../components/RouteStrip.tsx';
import { chatMeta, chatTitle } from '../lib/chats.ts';
import { useRealtime } from '../realtime/context.ts';
import { useNarrow } from '../ui/hooks.ts';
import { Button, Label, Page, Panel, PanelHeader, Stage } from '../ui/primitives.tsx';
import { size } from '../ui/theme.ts';

// Your chats, and whichever one is open.
export default function ChatPage() {
  const {
    isConnected, myId, users, chats, messages, unread, openChatId,
    selectChat, sendMessage, addMember, removeMember,
  } = useRealtime();
  const navigate = useNavigate();
  const narrow = useNarrow();

  if (!isConnected) {
    return <Navigate to="/" replace />;
  }

  const openChat = chats.find((chat) => chat.id === openChatId);
  const openMessages = messages[openChatId] ?? [];

  const list = (
    <Panel style={{ flex: narrow ? '1 1 auto' : '0 0 320px', minWidth: 0 }}>
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
        <ChatList
          chats={chats}
          myId={myId}
          unread={unread}
          openChatId={openChatId}
          onSelect={(chatId) => selectChat(chatId)}
        />
      )}
    </Panel>
  );

  const conversation = openChat ? (
    <Panel style={{ flex: '1 1 auto', minWidth: 0 }}>
      {narrow ? (
        <Button kind="quiet" onClick={() => selectChat('')} style={{ marginBottom: 14 }}>
          ← ALL CHATS
        </Button>
      ) : null}
      <PanelHeader
        route={chatTitle(openChat, myId)}
        meta={chatMeta(openChat, myId)}
        hint="ENTER TO SEND"
      />
      <Conversation
        chat={openChat}
        myId={myId}
        users={users}
        messages={openMessages}
        onSend={(text) => sendMessage(openChat.id, text)}
        onAdd={(userId) => addMember(openChat.id, userId)}
        onRemove={(userId) => removeMember(openChat.id, userId)}
      />
    </Panel>
  ) : (
    <Panel style={{ flex: '1 1 auto', minWidth: 0 }}>
      <PanelHeader route="/chat" meta="nothing open" hint="PICK ONE ON THE LEFT" />
      <Stage height={300} style={{ display: 'grid', placeItems: 'center' }}>
        <Label>NOTHING OPEN</Label>
      </Stage>
      <div style={{ marginTop: 16 }}>
        <Button kind="quiet" onClick={() => navigate('/people')}>
          AROUND YOU
        </Button>
      </div>
    </Panel>
  );

  // on a phone there is only room for one of the two, so the open chat wins
  if (narrow) {
    return (
      <Page>
        <RouteStrip />
        {openChat ? conversation : list}
      </Page>
    );
  }

  return (
    <Page>
      <RouteStrip />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: size.panelGap }}>
        {list}
        {conversation}
      </div>
    </Page>
  );
}
