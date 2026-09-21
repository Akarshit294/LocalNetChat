import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { ChatSummary } from '../lib/messages.ts';
import { useRealtime } from '../realtime/context.ts';

// A private chat has no name of its own, so it's named after the other people in it.
function chatTitle(chat: ChatSummary, myId: string) {
    if (chat.name) {
        return chat.name;
    }
    return chat.members
        .filter((member) => member.id !== myId)
        .map((member) => (member.online ? member.user_name : `${member.user_name} (disconnected)`))
        .join(', ');
}

function canWrite(chat: ChatSummary, myId: string) {
    // with nobody else connected there's nowhere for a message to go
    return chat.members.some((member) => member.id !== myId && member.online);
}

export default function ChatPage() {
    const { isConnected, myId, chats, messages, unread, openChatId, selectChat, sendMessage } = useRealtime();
    const [draft, setDraft] = useState('');

    if (!isConnected) {
        return <Navigate to="/" replace />;
    }

    const openChat = chats.find((chat) => chat.id === openChatId);
    const openMessages = messages[openChatId] ?? [];

    function nameOf(fromId: string) {
        if (fromId === myId) {
            return 'you';
        }
        const member = openChat?.members.find((one) => one.id === fromId);
        return member ? member.user_name : 'someone';
    }

    function send() {
        const text = draft.trim();
        if (openChat && text) {
            sendMessage(openChat.id, text);
            setDraft('');
        }
    }

    return (
        <>
            <h1>Chats</h1>
            <Link to="/people">Around you</Link>

            <ul>
                {chats.map((chat) => (
                    <li key={chat.id}>
                        <button onClick={() => selectChat(chat.id)} disabled={chat.id === openChatId}>
                            {chatTitle(chat, myId)}
                            {unread[chat.id] ? ` (${unread[chat.id]} new)` : ''}
                        </button>
                    </li>
                ))}
            </ul>
            {chats.length === 0 && <p>No chats yet. Pick someone on "Around you" and press Message.</p>}

            {openChat && (
                <>
                    <h2>{chatTitle(openChat, myId)}</h2>
                    <ul>
                        {openMessages.map((message) => (
                            <li key={`${message.sent_at}-${message.from_id}`}>
                                <b>{nameOf(message.from_id)}:</b> {message.text}
                            </li>
                        ))}
                    </ul>
                    {canWrite(openChat, myId) ? (
                        <>
                            <input
                                placeholder="Type a message..."
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && send()}
                            />
                            <button onClick={send} disabled={!draft.trim()}>Send</button>
                        </>
                    ) : (
                        <p>They have disconnected, so you can't send anything here.</p>
                    )}
                </>
            )}
        </>
    );
}
