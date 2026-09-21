import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast/headless';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import Notices from '../components/Notices.tsx';
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
                } else if (message.type === 'error') {
                    // it dismisses itself, so nothing has to clear it on the way out
                    toast.error(message.reason);
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
                toast.dismiss();   // whatever was on screen was about a connection we no longer have
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

    // we're not in userIds: the server adds us, from the socket this arrives on.
    // It answers with chat_opened, so the new group opens the same way a private chat does.
    function createGroup(userIds: string[], name: string) {
        const message: ClientMessage = { type: 'create_group', user_ids: userIds, name };
        sendJsonMessage(message);
    }

    // no roles, so anyone in a group may do either of these
    function addMember(chatId: string, userId: string) {
        const message: ClientMessage = { type: 'add_member', chat_id: chatId, user_id: userId };
        sendJsonMessage(message);
    }

    // passing our own id is how we leave. The server answers with a chats list
    // that no longer has the group in it, so it drops off the page by itself.
    function removeMember(chatId: string, userId: string) {
        const message: ClientMessage = { type: 'remove_member', chat_id: chatId, user_id: userId };
        sendJsonMessage(message);
    }

    const realtime = {
        isConnected: readyState === ReadyState.OPEN,
        closeReason,
        myId,
        joinedName,
        users,
        systemLine,
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
        createGroup,
        addMember,
        removeMember,
    };

    return (
        <RealtimeContext.Provider value={realtime}>
            <Notices />
            {children}
        </RealtimeContext.Provider>
    );
}
