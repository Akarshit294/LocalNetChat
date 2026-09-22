import { chatMeta, chatTitle, others } from '../lib/chats.ts';
import type { ChatSummary } from '../lib/messages.ts';
import { Avatar, AvatarStack } from '../ui/Avatar.tsx';
import { useHover } from '../ui/hooks.ts';
import { revealStyle } from '../ui/motion.ts';
import { Chip } from '../ui/primitives.tsx';
import { color, radius, type } from '../ui/theme.ts';

type Props = {
  chats: ChatSummary[];
  myId: string;
  unread: Record<string, number>;
  openChatId: string;
  onSelect: (chatId: string) => void;
};

function Row({
  chat,
  myId,
  unread,
  open,
  onSelect,
  index,
}: {
  chat: ChatSummary;
  myId: string;
  unread: number;
  open: boolean;
  onSelect: () => void;
  index: number;
}) {
  const { hovered, bind } = useHover();
  const rest = others(chat, myId);
  const lit = open || hovered;

  return (
    <button
      {...bind}
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: radius.bar,
        border: `1px solid ${open ? color.mint : lit ? color.hair : 'transparent'}`,
        background: lit ? color.paper : 'transparent',
        cursor: 'pointer',
        transition: 'background .22s ease-out, border-color .22s ease-out',
        ...revealStyle(index * 40),
      }}
    >
      {chat.type === 'group' ? (
        <AvatarStack ids={rest.map((member) => member.id)} px={28} />
      ) : (
        <Avatar
          id={rest[0]?.id ?? chat.id}
          px={28}
          state={rest.every((member) => member.online) ? 'rest' : 'offline'}
        />
      )}

      <span style={{ flex: '1 1 auto', minWidth: 0 }}>
        <span
          style={{
            ...type.name,
            color: color.ink,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chatTitle(chat, myId)}
        </span>
        <span
          style={{
            ...type.label,
            display: 'block',
            marginTop: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chatMeta(chat, myId).toUpperCase()}
        </span>
      </span>

      {unread ? <Chip>{unread} NEW</Chip> : null}
    </button>
  );
}

export default function ChatList({ chats, myId, unread, openChatId, onSelect }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {chats.map((chat, index) => (
        <Row
          key={chat.id}
          index={index}
          chat={chat}
          myId={myId}
          unread={unread[chat.id] ?? 0}
          open={chat.id === openChatId}
          onSelect={() => onSelect(chat.id)}
        />
      ))}
    </div>
  );
}
