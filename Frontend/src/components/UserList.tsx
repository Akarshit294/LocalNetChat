import type { ChatUser } from '../lib/messages.ts';

type UserListProps = {
    users: ChatUser[];
    myId: string;
};

// Who is online right now. The server sends the whole list again on every change.
export default function UserList({ users, myId }: UserListProps) {
    return (
        <>
            <h2>Online ({users.length})</h2>
            <ul>
                {users.map((user) => (
                    <li key={user.id}>
                        {user.user_name}{user.id === myId ? ' (you)' : ''}
                    </li>
                ))}
            </ul>
        </>
    );
}
