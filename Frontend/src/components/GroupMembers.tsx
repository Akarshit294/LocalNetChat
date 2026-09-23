import { useState } from 'react';
import type { ChatSummary, ChatUser } from '../lib/messages.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useCanHover, useHover } from '../ui/hooks.ts';
import { revealStyle } from '../ui/motion.ts';
import { Bar, Button, Chip, Label, Select, Stage } from '../ui/primitives.tsx';
import { color, radius, type } from '../ui/theme.ts';

// Who is in a group, and the two things anyone in it may do. No roles: the
// server lets any member add or remove any other, so the page does too.
//
// It takes the conversation's place in the panel rather than sitting above it,
// so a big group can't push what was said off the screen: the list scrolls
// where the transcript would, and adding someone sits where the composer would.

function MemberRow({
  member,
  isMe,
  onRemove,
  index,
}: {
  member: ChatSummary['members'][number];
  isMe: boolean;
  onRemove: () => void;
  index: number;
}) {
  const { hovered, bind } = useHover();
  // a finger can't hover, so on a touch screen the action is always showing
  const canHover = useCanHover();
  const showAction = hovered || !canHover;

  return (
    <div
      {...bind}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        borderRadius: radius.bar,
        background: hovered ? color.paper : 'transparent',
        border: `1px solid ${hovered ? color.hair : 'transparent'}`,
        transition: 'background .22s ease-out, border-color .22s ease-out',
        ...revealStyle(index * 40),
      }}
    >
      <Avatar id={member.id} px={28} state={isMe ? 'you' : member.online ? 'rest' : 'offline'} />

      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        <span
          style={{
            ...type.name,
            color: isMe ? color.you : color.ink,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {member.user_name}
        </span>
        <span style={{ ...type.label, display: 'block', marginTop: 4 }}>
          {isMe ? 'YOU' : member.online ? 'HERE' : 'DISCONNECTED'}
        </span>
      </span>

      {/* the action turns up on hover, and never as a row of buttons. The
          padding, taken back by the margin, makes it bigger to tap without
          moving it. */}
      <button
        type="button"
        onClick={onRemove}
        title={isMe ? 'leave this group' : `remove ${member.user_name}`}
        style={{
          border: 'none',
          background: 'none',
          padding: 8,
          margin: -8,
          cursor: 'pointer',
          opacity: showAction ? 1 : 0,
          transform: showAction ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity .22s ease-out, transform .22s ease-out',
        }}
      >
        <Chip>{isMe ? 'LEAVE' : 'REMOVE'}</Chip>
      </button>
    </div>
  );
}

export default function GroupMembers({
  chat,
  myId,
  users,
  onAdd,
  onRemove,
}: {
  chat: ChatSummary;
  myId: string;
  users: ChatUser[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  // who's picked in the "add someone" box
  const [toAdd, setToAdd] = useState('');

  // everyone online who isn't in this group yet. We're always a member, so
  // we're never in here.
  const addable = users.filter((user) => !chat.members.some((member) => member.id === user.id));
  // the pick is dropped if that person left or you switched chats, so the box
  // can never send an id that isn't on offer
  const pick = addable.some((user) => user.id === toAdd) ? toAdd : '';

  function add() {
    if (pick) {
      onAdd(pick);
      setToAdd('');
    }
  }

  return (
    <>
      <Stage
        style={{
          flex: '1 1 0',
          minHeight: 200,
          overflowY: 'auto',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {chat.members.map((member, index) => (
          <MemberRow
            key={member.id}
            index={index}
            member={member}
            isMe={member.id === myId}
            onRemove={() => onRemove(member.id)}
          />
        ))}
      </Stage>

      <Bar style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        {addable.length > 0 ? (
          <>
            <Select
              value={pick}
              onChange={setToAdd}
              ariaLabel="add someone to this group"
              style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 'none' }}
            >
              <option value="">add someone...</option>
              {addable.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.user_name}
                </option>
              ))}
            </Select>
            <Button onClick={add} disabled={!pick}>
              ADD
            </Button>
          </>
        ) : (
          <Label>EVERYONE ONLINE IS ALREADY IN HERE</Label>
        )}
      </Bar>
    </>
  );
}
