import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast/headless';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import CallPanel from '../components/CallPanel.tsx';
import Notices from '../components/Notices.tsx';
import { api, reasonOf, WS_URL } from '../lib/api.ts';
import { startDownload } from '../lib/files.ts';
import type {
    ChatEntry,
    ChatSummary,
    ChatUser,
    ClientMessage,
    ServerMessage,
} from '../lib/messages.ts';
import { noteArrivals } from './arrivals.ts';
import { RealtimeContext } from './context.ts';
import { useCall } from './useCall.ts';

// Owns the one socket and everything the server tells us. It sits above the
// routes, so moving between pages never drops the connection.
export default function RealtimeProvider({ children }: { children: ReactNode }) {
    // Set once POST /sessions has answered with our cookie. The socket's address
    // never changes: who we are travels in the cookie, not in the URL.
    const [shouldConnect, setShouldConnect] = useState(false);
    // the name the server knows us by right now. A rename changes this, not the URL.
    const [joinedName, setJoinedName] = useState('');
    // our own id, from the server's welcome. Needed to mark "you", and to address people later.
    const [myId, setMyId] = useState('');
    const [users, setUsers] = useState<ChatUser[]>([]);
    // who is new, so the page can ping them. Everyone in the first list we get
    // was already here, so only later arrivals count.
    const [arrivals, setArrivals] = useState<Record<string, number>>({});
    const seenIds = useRef<Set<string>>(new Set());
    const [systemLine, setSystemLine] = useState('');
    const [closeReason, setCloseReason] = useState('');
    const [chats, setChats] = useState<ChatSummary[]>([]);
    // the server relays messages and forgets them, so this is the only copy we have
    const [messages, setMessages] = useState<Record<string, ChatEntry[]>>({});
    const [unread, setUnread] = useState<Record<string, number>>({});
    const [openChatId, setOpenChatId] = useState('');
    // which chat is on screen, readable from inside the socket handler
    const openChatIdRef = useRef('');

    const { readyState, sendJsonMessage } = useWebSocket<ServerMessage>(
        WS_URL,
        {
            onMessage: (event) => {
                // the server sends the whole list again on every change
                const message = JSON.parse(event.data) as ServerMessage;
                onCallMessage(message);
                if (message.type === 'users') {
                    setUsers(message.users);
                    setArrivals(noteArrivals(seenIds.current, message.users));
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
                } else if (message.type === 'message' || message.type === 'file') {
                    // a shared file is a line of the conversation like any other
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
                setArrivals({});
                seenIds.current.clear();
                setSystemLine('');
                toast.dismiss();   // whatever was on screen was about a connection we no longer have
                setJoinedName('');
                setMyId('');
                setChats([]);
                setMessages({});
                setUnread({});
                selectChat('');
                dropCall();
            },
        },
        shouldConnect
    );

    // A call is set up over this same socket, so it is given the way to send on it.
    // Everything else about a call is in useCall.
    const { call, onMessage: onCallMessage, drop: dropCall } = useCall(sendJsonMessage);

    // Log in over HTTP first: the answer sets our session cookie, and only then is
    // the socket opened, carrying it. A name the server refuses is said on the join
    // page, the same place a refused join has always been explained.
    async function connect(name: string) {
        setCloseReason('');
        try {
            await api.createSession(name);
        } catch (error) {
            setCloseReason(reasonOf(error));
            return;
        }
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

    // A file goes up over HTTP, not this socket: one big upload here would hold
    // up every chat message behind it. Nothing is added to the conversation from
    // here. The server's "file" note does that, for us as for everyone.
    async function shareFile(chatId: string, file: File, onProgress?: (fraction: number) => void) {
        try {
            await api.shareFile(chatId, file, onProgress);
        } catch (error) {
            toast.error(reasonOf(error));
        }
    }

    function downloadFile(fileId: string, name: string) {
        startDownload(api.fileUrl(fileId), name);
    }

    const realtime = {
        isConnected: readyState === ReadyState.OPEN,
        closeReason,
        myId,
        joinedName,
        users,
        arrivals,
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
        shareFile,
        fileUrl: api.fileUrl,
        downloadFile,
        call,
    };

    return (
        <RealtimeContext.Provider value={realtime}>
            <Notices />
            <CallPanel />
            {children}
        </RealtimeContext.Provider>
    );
}
