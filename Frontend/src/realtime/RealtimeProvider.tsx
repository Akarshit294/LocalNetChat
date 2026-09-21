import { useRef, useState, type ReactNode } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { WS_URL } from '../lib/api.ts';
import type {
    ChatSummary,
    ChatTextMessage,
    ChatUser,
    ClientMessage,
    ServerMessage,
} from '../lib/messages.ts';
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
    const [chats, setChats] = useState<ChatSummary[]>([]);
    // the server relays messages and forgets them, so this is the only copy we have
    const [messages, setMessages] = useState<Record<string, ChatTextMessage[]>>({});
    const [unread, setUnread] = useState<Record<string, number>>({});
    const [openChatId, setOpenChatId] = useState('');
    // which chat is on screen, readable from inside the socket handler
    const openChatIdRef = useRef('');

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
                } else if (message.type === 'chats') {
                    setChats(message.chats);
                } else if (message.type === 'chat_opened') {
                    selectChat(message.chat_id);
                } else if (message.type === 'message') {
                    const chatId = message.chat_id;
                    setMessages((before) => ({
                        ...before,
                        [chatId]: [...(before[chatId] ?? []), message],
                    }));
                    if (chatId !== openChatIdRef.current) {
                        setUnread((before) => ({ ...before, [chatId]: (before[chatId] ?? 0) + 1 }));
                    }
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
                setChats([]);
                setMessages({});
                setUnread({});
                selectChat('');
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

    function openChat(userId: string) {
        const message: ClientMessage = { type: 'open_chat', user_id: userId };
        sendJsonMessage(message);
    }

    function selectChat(chatId: string) {
        openChatIdRef.current = chatId;
        setOpenChatId(chatId);
        setUnread((before) => ({ ...before, [chatId]: 0 }));
    }

    function sendMessage(chatId: string, text: string) {
        const message: ClientMessage = { type: 'send_message', chat_id: chatId, text };
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
        chats,
        messages,
        unread,
        openChatId,
        connect,
        disconnect,
        rename,
        openChat,
        selectChat,
        sendMessage,
    };

    return <RealtimeContext.Provider value={realtime}>{children}</RealtimeContext.Provider>;
}
