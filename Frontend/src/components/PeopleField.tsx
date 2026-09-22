import { useState } from 'react';
import { hash } from '../lib/animals.ts';
import type { ChatUser } from '../lib/messages.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useNarrow } from '../ui/hooks.ts';
import { driftStyle, revealStyle } from '../ui/motion.ts';
import { Chip, Label } from '../ui/primitives.tsx';
import { color, type } from '../ui/theme.ts';

// Around you: you in the middle, everyone else drifting around you.
//
// Spatial before tabular — this is the list of people, and it is not a list.
// Hovering holds someone still and fades everyone else; that fade, not the
// ring, is what says "this one".

type Props = {
  users: ChatUser[];
  myId: string;
  arrivals: Record<string, number>;
  // null while you're just looking; an array of ids while you're making a group
  picked: string[] | null;
  onToggle: (userId: string) => void;
  onOpen: (userId: string) => void;
};

// A ring around the middle. Every other token is pulled inwards, so a crowded
// network reads as a cloud rather than a clock face.
function spot(index: number, count: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const pull = count > 5 && index % 2 === 1 ? 0.7 : 1;
  return {
    left: `${50 + Math.cos(angle) * 33 * pull}%`,
    top: `${50 + Math.sin(angle) * 32 * pull}%`,
  };
}

function avatarSize(count: number, narrow: boolean) {
  if (narrow) {
    return count > 8 ? 34 : count > 5 ? 40 : 46;
  }
  return count > 8 ? 42 : count > 5 ? 48 : 56;
}

export default function PeopleField({ users, myId, arrivals, picked, onToggle, onOpen }: Props) {
  const narrow = useNarrow();
  const [held, setHeld] = useState('');

  const others = users.filter((user) => user.id !== myId);
  const me = users.find((user) => user.id === myId);
  const av = avatarSize(others.length, narrow);
  const box = av + 40;
  const picking = picked !== null;

  return (
    <>
      {/* you: the one still thing on the stage */}
      {me ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: box,
            marginLeft: -box / 2,
            marginTop: -av / 2,
            textAlign: 'center',
            ...revealStyle(60),
          }}
        >
          <Avatar id={me.id} px={av} state="you" style={{ margin: '0 auto' }} />
          <div style={{ ...type.name, color: color.you, marginTop: 8 }}>{me.user_name}</div>
        </div>
      ) : null}

      {others.map((user, index) => {
        const isPicked = picked?.includes(user.id) ?? false;
        const isHeld = held === user.id;
        const seed = hash(user.id);
        const chip = picking ? (isPicked ? 'IN' : 'PICK') : 'MESSAGE →';

        return (
          <div
            key={user.id}
            onMouseEnter={() => setHeld(user.id)}
            onMouseLeave={() => setHeld('')}
            onClick={() => (picking ? onToggle(user.id) : onOpen(user.id))}
            style={{
              position: 'absolute',
              ...spot(index, others.length),
              width: box,
              marginLeft: -box / 2,
              marginTop: -av / 2,
              cursor: 'pointer',
              // focus by subtraction: everything not held steps back
              opacity: held && !isHeld ? 0.45 : 1,
              transition: 'opacity .3s ease',
              ...revealStyle(120 + index * 55),
            }}
          >
            {/* drift and the hover lift are separate elements, or they fight
                over transform and pausing one freezes the other */}
            <div
              style={{
                ...driftStyle(seed),
                animationPlayState: isHeld ? 'paused' : 'running',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  transform: isHeld ? 'scale(1.14)' : 'scale(1)',
                  transformOrigin: `50% ${av / 2}px`,
                  transition: 'transform .32s cubic-bezier(.2,.9,.25,1)',
                }}
              >
                <Avatar
                  id={user.id}
                  px={av}
                  state={isPicked ? 'picked' : isHeld ? 'hot' : 'rest'}
                  pinging={!!arrivals[user.id]}
                  style={{ margin: '0 auto' }}
                />
                <div style={{ ...type.name, marginTop: 8 }}>{user.user_name}</div>
                <div
                  style={{
                    marginTop: 6,
                    opacity: isHeld || isPicked ? 1 : 0,
                    transform: isHeld || isPicked ? 'translateY(0)' : 'translateY(4px)',
                    transition: 'opacity .22s ease-out, transform .22s ease-out',
                  }}
                >
                  <Chip>{chip}</Chip>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {others.length === 0 ? (
        <Label
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '68%',
            textAlign: 'center',
          }}
        >
          NOBODY ELSE IS HERE YET
        </Label>
      ) : null}
    </>
  );
}
