import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { validateGroupName } from '../lib/validation.ts';
import { useRealtime } from '../realtime/context.ts';

// Everyone on this network right now.
export default function PeoplePage() {
    const { isConnected, users, myId, systemLine, unread, openChat, createGroup } = useRealtime();
    const navigate = useNavigate();
    // null while we're just looking. Making a group turns it into the picked ids,
    // so one piece of state says both "are we picking" and "who so far".
    const [picked, setPicked] = useState<string[] | null>(null);
    const [groupName, setGroupName] = useState('');

    // no connection, nothing to show: back to the join page
    if (!isConnected) {
        return <Navigate to="/" replace />;
    }

    const waiting = Object.values(unread).reduce((total, count) => total + count, 0);
    const nameError = picked === null ? null : validateGroupName(groupName);
    const canCreate = picked !== null && picked.length > 0 && nameError === null;

    function messageThem(userId: string) {
        openChat(userId);       // the server answers with the chat, and the provider opens it
        navigate('/chat');
    }

    function togglePicked(userId: string) {
        setPicked((before) => {
            if (before === null) {
                return before;
            }
            return before.includes(userId)
                ? before.filter((id) => id !== userId)
                : [...before, userId];
        });
    }

    function stopPicking() {
        setPicked(null);
        setGroupName('');
    }

    function makeGroup() {
        if (picked && canCreate) {
            // we don't send our own id: the server adds us from the socket
            createGroup(picked, groupName.trim());
            stopPicking();
            navigate('/chat');
        }
    }

    return (
        <>
            <h1>Around you</h1>
            <h2>Online ({users.length})</h2>
            <ul>
                {users.map((user) => (
                    <li key={user.id}>
                        {picked !== null && user.id !== myId && (
                            <input
                                type="checkbox"
                                checked={picked.includes(user.id)}
                                onChange={() => togglePicked(user.id)}
                            />
                        )}
                        {user.user_name}{user.id === myId ? ' (you)' : ''}
                        {picked === null && user.id !== myId && (
                            <button onClick={() => messageThem(user.id)}>Message</button>
                        )}
                    </li>
                ))}
            </ul>

            {picked === null ? (
                // with nobody else here there is no group to make
                <button onClick={() => setPicked([])} disabled={users.length < 2}>New group</button>
            ) : (
                <>
                    <p>Tick who's in it, then give it a name.</p>
                    <input
                        placeholder="Group name..."
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && makeGroup()}
                    />
                    {/* an empty box is where you start, so don't call it an error yet */}
                    {groupName.trim() !== '' && nameError && <p>{nameError}</p>}
                    <button onClick={makeGroup} disabled={!canCreate}>
                        Create{picked.length ? ` (${picked.length})` : ''}
                    </button>
                    <button onClick={stopPicking}>Cancel</button>
                </>
            )}

            {systemLine && <p>{systemLine}</p>}
            <Link to="/chat">Chats{waiting ? ` (${waiting} new)` : ''}</Link>
            <Link to="/you">You</Link>
        </>
    );
}
