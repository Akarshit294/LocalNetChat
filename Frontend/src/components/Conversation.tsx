import { useEffect, useRef, useState } from 'react';
import { canWrite, clockOf } from '../lib/chats.ts';
import type { ChatSummary, ChatTextMessage, ChatUser } from '../lib/messages.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useNarrow } from '../ui/hooks.ts';
import { revealStyle } from '../ui/motion.ts';
import { Bar, Button, Field, Label, Stage } from '../ui/primitives.tsx';
import { color, radius, type } from '../ui/theme.ts';
import GroupMembers from './GroupMembers.tsx';

// What was said, and the box to say something back.
//
// Messages are relayed and never stored, so this is everything that arrived
// while this page was connected. Reloading loses it, which is true of the app.

type Props = {
  chat: ChatSummary;
  myId: string;
  users: ChatUser[];
  messages: ChatTextMessage[];
  onSend: (text: string) => void;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
};

export default function Conversation({ chat, myId, users, messages, onSend, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('');
  const narrow = useNarrow();
  const boxRef = useRef<HTMLDivElement>(null);

  // the newest line is the one you want to see, so the transcript sits at the
  // bottom whenever it grows or you switch chats
  useEffect(() => {
    const box = boxRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [messages.length, chat.id]);

  const writable = canWrite(chat, myId);

  function nameOf(fromId: string) {
    const member = chat.members.find((one) => one.id === fromId);
    return member ? member.user_name : 'someone';
  }

  function send() {
    const text = draft.trim();
    if (text) {
      onSend(text);
      setDraft('');
    }
  }

  return (
    <>
      {/* only a group has members worth listing, and only a group can change them */}
      {chat.type === 'group' ? (
        <GroupMembers chat={chat} myId={myId} users={users} onAdd={onAdd} onRemove={onRemove} />
      ) : null}

      <Stage
        scrollRef={boxRef}
        style={{
          height: narrow ? 320 : 380,
          overflowY: 'auto',
          padding: '16px 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {messages.length === 0 ? (
          <Label style={{ margin: 'auto', textAlign: 'center' }}>NOTHING SAID YET</Label>
        ) : null}

        {messages.map((message, index) => {
          const mine = message.from_id === myId;
          const previous = messages[index - 1];
          const next = messages[index + 1];
          const startsRun = !previous || previous.from_id !== message.from_id;
          const endsRun = !next || next.from_id !== message.from_id;

          return (
            <div
              key={`${message.sent_at}-${message.from_id}-${index}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: mine ? 'flex-end' : 'flex-start',
                marginTop: startsRun && index > 0 ? 8 : 0,
                ...revealStyle(0),
              }}
            >
              {!mine && startsRun ? (
                <Label style={{ marginBottom: 4, marginLeft: 35 }}>
                  {nameOf(message.from_id).toUpperCase()}
                </Label>
              ) : null}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, maxWidth: '84%' }}>
                {/* a face on the incoming side, once per run, so a back-and-forth
                    doesn't turn into a column of heads */}
                {!mine ? (
                  <div style={{ width: 26, flex: '0 0 auto' }}>
                    {endsRun ? <Avatar id={message.from_id} px={26} /> : null}
                  </div>
                ) : null}

                <div
                  style={{
                    ...type.body,
                    lineHeight: 1.55,
                    padding: '9px 12px',
                    borderRadius: radius.bar,
                    border: `1px solid ${color.hair}`,
                    background: mine ? color.mintWash : color.paper,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.text}
                </div>
              </div>

              {/* the clock once per run, under the last thing they said */}
              {endsRun ? (
                <Label style={{ marginTop: 4, marginLeft: mine ? 0 : 35 }}>
                  {clockOf(message.sent_at)}
                </Label>
              ) : null}
            </div>
          );
        })}
      </Stage>

      {writable ? (
        <Bar style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Field
            value={draft}
            onChange={setDraft}
            placeholder="say something..."
            ariaLabel="message"
            maxLength={1000}
            onKeyDown={(event) => event.key === 'Enter' && send()}
          />
          <Button onClick={send} disabled={!draft.trim()}>
            SEND
          </Button>
        </Bar>
      ) : (
        <Bar style={{ marginTop: 14 }}>
          <Label>NOBODY ELSE IN HERE IS CONNECTED, SO THERE IS NOWHERE TO SEND IT</Label>
        </Bar>
      )}
    </>
  );
}
