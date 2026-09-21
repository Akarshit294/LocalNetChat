import { Link, Navigate } from 'react-router-dom';
import UserList from '../components/UserList.tsx';
import { useRealtime } from '../realtime/context.ts';

// Everyone on this network right now.
export default function PeoplePage() {
    const { isConnected, users, myId, systemLine } = useRealtime();

    // no connection, nothing to show: back to the join page
    if (!isConnected) {
        return <Navigate to="/" replace />;
    }

    return (
        <>
            <h1>Around you</h1>
            <UserList users={users} myId={myId} />
            {systemLine && <p>{systemLine}</p>}
            <Link to="/you">You</Link>
        </>
    );
}
