import { useEffect, useState } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { api, WS_URL } from '../lib/api.ts';
import useDebounce from '../hooks/useDebounce';
import { validateUsername } from '../lib/validation.ts';
import type { ChatUser, ClientMessage, ServerMessage } from '../lib/messages.ts';
import JoinView from './JoinView.tsx';
import NameInput from './NameInput.tsx';
import UserList from './UserList.tsx';

// Owns the socket and the name state, and decides which screen to show.
// The socket lives here so switching screens never drops the connection.
export default function Home() {
    const [connect, setConnect] = useState(false);
    const [name, setName] = useState('');
    const [status, setStatus] = useState('');
    const [ready, setReady] = useState(false);
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [systemLine, setSystemLine] = useState('');
    // the name we dialled with. Fixed for the life of this socket, because changing
    // the URL would make the hook drop the connection and open a new one.
    const [connectName, setConnectName] = useState('');
    // the name the server knows us by right now. A rename changes this, not the URL.
    const [joinedName, setJoinedName] = useState('');
    const [errorLine, setErrorLine] = useState('');
    const nameError = validateUsername(name);
    const debouncedName = useDebounce(name, 500);
    // built from the dialled name, so neither typing nor a rename reopens the socket
    const ws_url = `${WS_URL}?username=${encodeURIComponent(connectName)}`;

    const { readyState, sendJsonMessage } = useWebSocket<ServerMessage>(
        ws_url,
        {  onMessage: (event) => {
            // the server sends the whole list again on every change
            const message = JSON.parse(event.data) as ServerMessage;
            if (message.type === 'users') {
                setUsers(message.users);
            } else if (message.type === 'system') {
                setSystemLine(message.text);
            } else if (message.type === 'renamed') {
                // the server accepted it, so this is the name it knows us by now
                setJoinedName(message.new_name);
                setErrorLine('');
            } else if (message.type === 'error') {
                setErrorLine(message.reason);
            }
        },
        onClose: (event) => {
            setConnect(false);
            setStatus(event.reason);
            // the list belongs to a live connection, so it goes with it
            setUsers([]);
            setSystemLine('');
            setJoinedName('');
            setConnectName('');
            setErrorLine('');
        },},
        connect && !!connectName
    );

    useEffect(() => {
        async function verifyUsername() {
            setStatus('checking...');
            try {
                const data = await api.verifyUsername(debouncedName);
                setStatus(data.available ? 'available' : 'unavailable');
                setReady(data.available);
            } catch (err) {
                console.error('Username verification failed:', err);
                setStatus('unreachable');
            }
        }

        if (debouncedName && !validateUsername(debouncedName)) {
            verifyUsername();
        }
    }, [debouncedName]);

    function handleNameChange(value: string) {
        setName(value);
        setReady(false);   // the old answer was about the old name
        setStatus('');
    }

    function handleConnect() {
        const dialled = name.trim();
        setConnectName(dialled);   // used for the URL, and never changed after this
        setJoinedName(dialled);    // what the server will know us as, until a rename
        setConnect(true);
    }

    function handleRename() {
        const message: ClientMessage = { type: 'rename', user_name: name.trim() };
        sendJsonMessage(message);
    }

    // nothing to rename to unless the name is valid and actually different
    const canRename = nameError === null && name.trim() !== joinedName;

    return(
        connect === false ?
            <JoinView
                name={name}
                onNameChange={handleNameChange}
                nameError={nameError}
                status={status}
                isConnected={readyState === ReadyState.OPEN}
                canConnect={nameError === null && ready}
                onConnect={handleConnect}
            /> :
            <>
                <p>Edit User Name</p>
                <NameInput value={name} onChange={handleNameChange} error={nameError} status={status} />
                <button onClick={handleRename} disabled={!canRename}>Rename</button>
                <button onClick={() => setConnect(false)}>Disconnect</button>
                {errorLine && <p>{errorLine}</p>}
                {systemLine && <p>{systemLine}</p>}
                <UserList users={users} />
            </>
    )
}