import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'react-hot-toast/headless';
import { canWrite, clockOf } from '../lib/chats.ts';
import { sizeOf } from '../lib/files.ts';
import type { ChatEntry, ChatFileMessage, ChatSummary } from '../lib/messages.ts';
import { FILE_MAX_BYTES, validateFileName } from '../lib/validation.ts';
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
  onShare: (file: File) => Promise<void>;
  onDownload: (fileId: string, name: string) => Promise<void>;
};

export default function Conversation({ chat, myId, messages, onlineIds, onSend, onShare, onDownload }: Props) {
  const [draft, setDraft] = useState('');
  const [sharing, setSharing] = useState(false);
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
    setSharing(true);
    try {
      await onShare(file);
    } finally {
      setSharing(false);
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
            disabled={sharing}
            title="share a file with this chat, up to 50 MB"
          >
            {sharing ? 'SENDING…' : 'FILE'}
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

// A shared file in the conversation: what it is, and a way to fetch it while it
// still exists. The server drops a file when the person who shared it leaves.
function FileLine({
  file,
  gone,
  onDownload,
}: {
  file: ChatFileMessage;
  gone: boolean;
  onDownload: (fileId: string, name: string) => Promise<void>;
}) {
  const [fetching, setFetching] = useState(false);

  async function download() {
    setFetching(true);
    try {
      await onDownload(file.file_id, file.name);
    } finally {
      setFetching(false);
    }
  }

  // "octet-stream" is the label for "bytes, kind unknown", which says nothing
  // worth reading
  const kind = file.content_type === 'application/octet-stream' ? 'FILE' : file.content_type.toUpperCase();

  return (
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
        <Button kind="quiet" onClick={() => { void download(); }} disabled={fetching}>
          {fetching ? 'FETCHING…' : 'DOWNLOAD'}
        </Button>
      )}
    </div>
  );
}
