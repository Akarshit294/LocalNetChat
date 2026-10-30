import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { toast } from 'react-hot-toast/headless';
import { canWrite, clockOf } from '../lib/chats.ts';
import { sizeOf } from '../lib/files.ts';
import type { ChatEntry, ChatFileMessage, ChatSummary } from '../lib/messages.ts';
import { FILE_MAX_BYTES, safeMediaType, validateFileName } from '../lib/validation.ts';
import { Avatar } from '../ui/Avatar.tsx';
import { revealStyle } from '../ui/motion.ts';
import { Bar, Button, Field, Label, Stage } from '../ui/primitives.tsx';
import { color, radius, type } from '../ui/theme.ts';

// What was said and shared, and the box to say something back.
//
// Messages are relayed and never stored, so this is everything that arrived
// while this page was connected. Reloading loses it, which is true of the app.
// A file's bytes stay on the server until whoever shared it leaves, so a file
// line can outlive the file it points to.

type Props = {
  chat: ChatSummary;
  myId: string;
  messages: ChatEntry[];
  onlineIds: Set<string>;   // who is connected now: a shared file goes when its sharer does
  onSend: (text: string) => void;
  // finishes when the upload does, reporting 0 to 1 on the way
  onShare: (file: File, onProgress: (fraction: number) => void) => Promise<void>;
  fileUrl: (fileId: string) => string;   // where a preview fetches the file from
  onDownload: (fileId: string, name: string) => void;
};

export default function Conversation({ chat, myId, messages, onlineIds, onSend, onShare, fileUrl, onDownload }: Props) {
  const [draft, setDraft] = useState('');
  // how much of the file being shared has gone up, 0 to 1. Null when none is.
  const [sharing, setSharing] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

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

  // The same two rules the server holds, checked here first so a file that would
  // be refused is never uploaded at all. The server checks again regardless.
  async function share(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // emptied at once, so picking the same file a second time still counts
    event.target.value = '';
    if (!file) {
      return;
    }
    const problem =
      validateFileName(file.name) ?? (file.size > FILE_MAX_BYTES ? 'That file is over 50 MB' : null);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSharing(0);
    try {
      await onShare(file, setSharing);
    } finally {
      setSharing(null);
    }
  }

  return (
    <>
      {/* takes whatever height the panel has left, and scrolls inside it, so
          the composer stays on screen however much has been said */}
      <Stage
        scrollRef={boxRef}
        style={{
          flex: '1 1 0',
          minHeight: 200,
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
              key={message.type === 'file' ? message.file_id : `${message.sent_at}-${message.from_id}-${index}`}
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
                    minWidth: 0,
                  }}
                >
                  {message.type === 'file' ? (
                    <FileLine
                      file={message}
                      gone={!onlineIds.has(message.from_id)}
                      url={fileUrl(message.file_id)}
                      onDownload={onDownload}
                    />
                  ) : (
                    message.text
                  )}
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
          {/* the browser's own file picker, opened by the FILE button: an input
              can't be styled, but it can be clicked from somewhere that can */}
          <input ref={pickerRef} type="file" hidden onChange={(event) => { void share(event); }} />
          <Button
            kind="quiet"
            onClick={() => pickerRef.current?.click()}
            disabled={sharing !== null}
            title="share a file with this chat, up to 50 MB"
          >
            {sharing === null ? 'FILE' : `SENDING ${Math.round(sharing * 100)}%`}
          </Button>
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

// A shared file in the conversation: what it is, a look at it if it's an
// image, a video or a sound, and a way to save it, while it still exists. The
// server drops a file when the person who shared it leaves, and the preview
// goes with it.
function FileLine({
  file,
  gone,
  url,
  onDownload,
}: {
  file: ChatFileMessage;
  gone: boolean;
  url: string;
  onDownload: (fileId: string, name: string) => void;
}) {
  // the same rule the server uses to decide what it sends as itself
  const shown = safeMediaType(file.content_type);
  // "octet-stream" is the label for "bytes, kind unknown", which says nothing
  // worth reading
  const kind = file.content_type === 'application/octet-stream' ? 'FILE' : file.content_type.toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shown && !gone ? <Preview kind={shown} url={url} name={file.name} /> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div>{file.name}</div>
          <Label style={{ marginTop: 2 }}>
            {sizeOf(file.size)} · {kind}
          </Label>
        </div>
        {gone ? (
          <Label>GONE: THEY LEFT</Label>
        ) : (
          <Button kind="quiet" onClick={() => onDownload(file.file_id, file.name)}>
            DOWNLOAD
          </Button>
        )}
      </div>
    </div>
  );
}

const media: CSSProperties = { display: 'block', maxWidth: '100%', borderRadius: radius.bar - 4 };

// The file itself, fetched by the element straight from the server: the page
// never holds the bytes. An image waits until it's scrolled near (`lazy`), so a
// chat of a hundred pictures fetches the few on screen. A video or a sound
// fetches only its start (`metadata`) until it's played, and then asks for
// pieces with Range as it goes, so a long one never sits in memory whole.
function Preview({ kind, url, name }: { kind: string; url: string; name: string }) {
  if (kind.startsWith('image/')) {
    return <img src={url} alt={name} loading="lazy" style={{ ...media, maxHeight: 260 }} />;
  }
  if (kind.startsWith('video/')) {
    // playsInline, or an iPhone takes it full screen
    return <video src={url} controls playsInline preload="metadata" style={{ ...media, width: 320, maxHeight: 260 }} />;
  }
  return <audio src={url} controls preload="metadata" style={{ ...media, width: 280 }} />;
}
