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
    const {
        isConnected, myId, users, chats, messages, unread, openChatId,
        selectChat, sendMessage, addMember, removeMember,
    } = useRealtime();
    const [draft, setDraft] = useState('');
    // who's picked in the "add someone" box
    const [toAdd, setToAdd] = useState('');

    if (!isConnected) {
        return <Navigate to="/" replace />;
    }

    const openChat = chats.find((chat) => chat.id === openChatId);
    const openMessages = messages[openChatId] ?? [];
    // everyone online who isn't in this group yet. We're always a member, so we're never here.
    const addable = openChat
        ? users.filter((user) => !openChat.members.some((member) => member.id === user.id))
        : [];
    // the pick is dropped if that person left or you switched chats, so the box
    // can never send an id that isn't on offer
    const pick = addable.some((user) => user.id === toAdd) ? toAdd : '';

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

    function add() {
        if (openChat && pick) {
            addMember(openChat.id, pick);
            setToAdd('');
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

                    {/* only a group has members worth listing, and only a group can change them */}
                    {openChat.type === 'group' && (
                        <>
                            <h3>In this group ({openChat.members.length})</h3>
                            <ul>
                                {openChat.members.map((member) => (
                                    <li key={member.id}>
                                        {member.user_name}
                                        {member.id === myId && ' (you)'}
                                        {member.id !== myId && !member.online && ' (disconnected)'}
                                        {/* no roles yet, so anyone in the group may do this */}
                                        <button onClick={() => removeMember(openChat.id, member.id)}>
                                            {member.id === myId ? 'Leave' : 'Remove'}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {addable.length > 0 && (
                                <>
                                    <select value={pick} onChange={(event) => setToAdd(event.target.value)}>
                                        <option value="">Add someone...</option>
                                        {addable.map((user) => (
                                            <option key={user.id} value={user.id}>{user.user_name}</option>
                                        ))}
                                    </select>
                                    <button onClick={add} disabled={!pick}>Add</button>
                                </>
                            )}
                        </>
                    )}

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
                        <p>Nobody else here is connected, so you can't send anything.</p>
                    )}
                </>
            )}
        </>
    );
}
