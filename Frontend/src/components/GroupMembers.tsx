import { useState } from 'react';
import type { ChatSummary, ChatUser } from '../lib/messages.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useHover } from '../ui/hooks.ts';
import { Bar, Button, Chip, Label, Select } from '../ui/primitives.tsx';
import { color, type } from '../ui/theme.ts';

// Who is in a group, and the two things anyone in it may do. No roles: the
// server lets any member add or remove any other, so the page does too.

function MemberRow({
  member,
  isMe,
  onRemove,
}: {
  member: ChatSummary['members'][number];
  isMe: boolean;
  onRemove: () => void;
}) {
  const { hovered, bind } = useHover();

  return (
    <div
      {...bind}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '5px 6px 5px 5px',
        borderRadius: 999,
        background: hovered ? color.paper : 'transparent',
        border: `1px solid ${hovered ? color.hair : 'transparent'}`,
        transition: 'background .22s ease-out, border-color .22s ease-out',
      }}
    >
      <Avatar id={member.id} px={26} state={isMe ? 'you' : member.online ? 'rest' : 'offline'} />
      <span style={{ ...type.name, color: isMe ? color.you : color.inkMuted }}>
        {member.user_name}
      </span>
      {/* the action turns up on hover, and never as a row of buttons */}
      <button
        type="button"
        onClick={onRemove}
        title={isMe ? 'leave this group' : `remove ${member.user_name}`}
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(4px)',
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
    <Bar style={{ marginBottom: 14 }}>
      <Label>IN THIS GROUP ({chat.members.length})</Label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
        {chat.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isMe={member.id === myId}
            onRemove={() => onRemove(member.id)}
          />
        ))}
      </div>

      {addable.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Select value={pick} onChange={setToAdd} ariaLabel="add someone to this group">
            <option value="">add someone...</option>
            {addable.map((user) => (
              <option key={user.id} value={user.id}>
                {user.user_name}
              </option>
            ))}
          </Select>
          <Button kind="quiet" onClick={add} disabled={!pick}>
            ADD
          </Button>
        </div>
      ) : null}
    </Bar>
  );
}
