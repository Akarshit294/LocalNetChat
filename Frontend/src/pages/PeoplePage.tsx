import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useRealtime } from '../realtime/context.ts';

// Everyone on this network right now.
export default function PeoplePage() {
    const { isConnected, users, myId, systemLine, unread, openChat } = useRealtime();
    const navigate = useNavigate();

    // no connection, nothing to show: back to the join page
    if (!isConnected) {
        return <Navigate to="/" replace />;
    }

    const waiting = Object.values(unread).reduce((total, count) => total + count, 0);

    function messageThem(userId: string) {
        openChat(userId);       // the server answers with the chat, and the provider opens it
        navigate('/chat');
    }

    return (
        <>
            <h1>Around you</h1>
            <h2>Online ({users.length})</h2>
            <ul>
                {users.map((user) => (
                    <li key={user.id}>
                        {user.user_name}{user.id === myId ? ' (you)' : ''}
                        {user.id !== myId && (
                            <button onClick={() => messageThem(user.id)}>Message</button>
                        )}
                    </li>
                ))}
            </ul>
            {systemLine && <p>{systemLine}</p>}
            <Link to="/chat">Chats{waiting ? ` (${waiting} new)` : ''}</Link>
            <Link to="/you">You</Link>
        </>
    );
}
