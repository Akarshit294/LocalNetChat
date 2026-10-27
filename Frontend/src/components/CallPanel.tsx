import { useEffect, useRef, type CSSProperties } from 'react';
import { useRealtime } from '../realtime/context.ts';
import type { CallPhase } from '../realtime/useCall.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { useNarrow } from '../ui/hooks.ts';
import { Bar, Button, Panel, PanelHeader, Stage } from '../ui/primitives.tsx';
import { color, radius, size } from '../ui/theme.ts';

// A camera or a microphone, playing. A stream has no URL to put in `src`, so it
// is handed to the element itself, and React has no prop for that.
function Media({ stream, muted, style }: { stream: MediaStream; muted?: boolean; style: CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  // playsInline, or an iPhone takes the picture full screen
  return <video ref={ref} autoPlay playsInline muted={muted} style={style} />;
}

const STATUS: Record<CallPhase, string> = {
  idle: '',
  calling: 'CALLING...',
  ringing: 'IS CALLING YOU',
  connecting: 'CONNECTING...',
  connected: 'CONNECTED',
};

const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
// still playing, so their voice is heard, with nothing to look at
const unseen: CSSProperties = { position: 'absolute', width: 0, height: 0 };

// The call in progress, over whatever page you happen to be on.
//
// Mounted beside <Notices />, above the routes, and for the same reason: a call
// arrives on a connection that outlives the page, so what shows it has to
// outlive the page as well.
export default function CallPanel() {
  const { call, users } = useRealtime();
  const narrow = useNarrow();

  if (call.phase === 'idle') {
    return null;
  }

  const peer = users.find((user) => user.id === call.peerId);
  const connected = call.phase === 'connected';
  // their picture, once there is one. Until then, and all through a voice call, their face
  const showPicture = call.video && connected;

  return (
    <div
      role="dialog"
      aria-label="call"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,   // under the notices, so a refusal can still be read
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        overflowY: 'auto',
        background: color.scrim,
      }}
    >
      <Panel style={{ width: '100%', maxWidth: call.video ? 560 : 380 }}>
        <PanelHeader
          route={peer ? peer.user_name : 'someone'}
          meta={call.video ? 'video call' : 'voice call'}
          hint={STATUS[call.phase]}
        />

        <Stage
          style={{
            display: 'grid',
            placeItems: 'center',
            height: call.video ? undefined : 200,
            // a phone is held upright, and so is its camera
            aspectRatio: call.video ? (narrow ? '3 / 4' : '4 / 3') : undefined,
          }}
        >
          {call.remoteStream ? (
            <Media stream={call.remoteStream} style={showPicture ? fill : unseen} />
          ) : null}

          {showPicture ? null : <Avatar id={call.peerId} px={size.token} pinging={!connected} />}

          {/* ourselves, small, muted so we don't hear our own voice, and flipped
              the way a mirror would show us */}
          {call.video && call.localStream ? (
            <Media
              stream={call.localStream}
              muted
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                width: '26%',
                borderRadius: radius.bar,
                border: `1px solid ${color.hair}`,
                transform: 'scaleX(-1)',
              }}
            />
          ) : null}
        </Stage>

        <Bar style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          {call.phase === 'ringing' ? (
            <>
              <Button onClick={call.pickUp}>PICK UP</Button>
              <Button kind="quiet" onClick={call.hangUp}>
                DECLINE
              </Button>
            </>
          ) : (
            <>
              {connected ? (
                <Button kind="quiet" onClick={call.toggleMute}>
                  {call.muted ? 'UNMUTE' : 'MUTE'}
                </Button>
              ) : null}
              {connected && call.video ? (
                <Button kind="quiet" onClick={call.toggleCamera}>
                  {call.cameraOff ? 'CAMERA ON' : 'CAMERA OFF'}
                </Button>
              ) : null}
              <Button onClick={call.hangUp}>{call.phase === 'calling' ? 'CANCEL' : 'HANG UP'}</Button>
            </>
          )}
        </Bar>
      </Panel>
    </div>
  );
}
