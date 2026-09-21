import { useState, type ReactNode } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { WS_URL } from '../lib/api.ts';
import type { ChatUser, ClientMessage, ServerMessage } from '../lib/messages.ts';
import { RealtimeContext } from './context.ts';

// Owns the one socket and everything the server tells us. It sits above the
// routes, so moving between pages never drops the connection.
export default function RealtimeProvider({ children }: { children: ReactNode }) {
    const [shouldConnect, setShouldConnect] = useState(false);
    // the name we dialled with. Fixed for the life of this socket, because changing
    // the URL would make the hook drop the connection and open a new one.
    const [connectName, setConnectName] = useState('');
    // the name the server knows us by right now. A rename changes this, not the URL.
    const [joinedName, setJoinedName] = useState('');
    // our own id, from the server's welcome. Needed to mark "you", and to address people later.
    const [myId, setMyId] = useState('');
    const [users, setUsers] = useState<ChatUser[]>([]);
    const [systemLine, setSystemLine] = useState('');
    const [errorLine, setErrorLine] = useState('');
    const [closeReason, setCloseReason] = useState('');

    const ws_url = `${WS_URL}?username=${encodeURIComponent(connectName)}`;

    const { readyState, sendJsonMessage } = useWebSocket<ServerMessage>(
        ws_url,
        {
            onMessage: (event) => {
                // the server sends the whole list again on every change
                const message = JSON.parse(event.data) as ServerMessage;
                if (message.type === 'users') {
                    setUsers(message.users);
                } else if (message.type === 'system') {
                    setSystemLine(message.text);
                } else if (message.type === 'welcome') {
                    setMyId(message.user_id);
                    setJoinedName(message.user_name);
                } else if (message.type === 'renamed') {
                    // the server accepted it, so this is the name it knows us by now
                    setJoinedName(message.new_name);
                    setErrorLine('');
                } else if (message.type === 'error') {
                    setErrorLine(message.reason);
                }
            },
            onClose: (event) => {
                setShouldConnect(false);
                setCloseReason(event.reason);
                // everything below belongs to a live connection, so it goes with it
                setUsers([]);
                setSystemLine('');
                setErrorLine('');
                setJoinedName('');
                setConnectName('');
                setMyId('');
            },
        },
        shouldConnect && !!connectName
    );

    function connect(name: string) {
        setCloseReason('');
        setConnectName(name);   // used for the URL, and never changed after this
        setJoinedName(name);    // what the server will know us as, until a rename
        setShouldConnect(true);
    }

    function disconnect() {
        setShouldConnect(false);
    }

    function rename(name: string) {
        const message: ClientMessage = { type: 'rename', user_name: name };
        sendJsonMessage(message);
    }

    const realtime = {
        isConnected: readyState === ReadyState.OPEN,
        closeReason,
        myId,
        joinedName,
        users,
        systemLine,
        errorLine,
        connect,
        disconnect,
        rename,
    };

    return <RealtimeContext.Provider value={realtime}>{children}</RealtimeContext.Provider>;
}
