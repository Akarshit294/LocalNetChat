import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast/headless';
import Notices from '../components/Notices.tsx';
import type {
    ChatSummary,
    ChatTextMessage,
    ChatUser,
    ServerMessage,
} from '../lib/messages.ts';
import { JOIN_AS, WANTS_DEMO } from '../lib/mode.ts';
import { noteArrivals } from './arrivals.ts';
import { RealtimeContext } from './context.ts';
import { net } from './mockServer.ts';

// RealtimeProvider with the socket taken out and ./mockServer put in its place.
// The same handling of everything that arrives, so a page cannot tell which one
// it is mounted under. Lab only — the app keeps RealtimeProvider.

// ?as=meera3 joins before React has rendered anything, and &demo puts a chat
// and a group on the page already in progress.
//
// It folds the server's opening messages into the state the provider starts
// with, rather than connecting in an effect. Connecting later would mean every
// page rendering once with no connection, bouncing to the join screen, and
// being sent on to /people from there — so /chat?as=…&demo would never actually
// land on /chat.
function bootState() {
    const state = {
        isConnected: false,
        myId: '',
        joinedName: '',
        users: [] as ChatUser[],
        systemLine: '',
        chats: [] as ChatSummary[],
        messages: {} as Record<string, ChatTextMessage[]>,
        unread: {} as Record<string, number>,
        openChatId: '',
    };
    if (!JOIN_AS) {
        return state;
    }

    for (const message of net.bootstrap(JOIN_AS, WANTS_DEMO)) {
        if (message.type === 'welcome') {
            state.isConnected = true;
            state.myId = message.user_id;
            state.joinedName = message.user_name;
        } else if (message.type === 'users') {
            state.users = message.users;
        } else if (message.type === 'system') {
            state.systemLine = message.text;
        } else if (message.type === 'chats') {
            state.chats = message.chats;
        } else if (message.type === 'chat_opened') {
            state.openChatId = message.chat_id;
            state.unread = { ...state.unread, [message.chat_id]: 0 };
        } else if (message.type === 'message') {
            const chatId = message.chat_id;
            state.messages = {
                ...state.messages,
                [chatId]: [...(state.messages[chatId] ?? []), message],
            };
            if (chatId !== state.openChatId) {
                state.unread = { ...state.unread, [chatId]: (state.unread[chatId] ?? 0) + 1 };
            }
        }
    }
    return state;
}

export default function MockProvider({ children }: { children: ReactNode }) {
    const [boot] = useState(bootState);
    const [isConnected, setIsConnected] = useState(boot.isConnected);
    const [joinedName, setJoinedName] = useState(boot.joinedName);
    const [myId, setMyId] = useState(boot.myId);
    const [users, setUsers] = useState<ChatUser[]>(boot.users);
    const [arrivals, setArrivals] = useState<Record<string, number>>({});
    // everyone in the opening list was already here, so nobody pings on the way in
    const seenIds = useRef<Set<string>>(new Set(boot.users.map((user) => user.id)));
    const [systemLine, setSystemLine] = useState(boot.systemLine);
    const [closeReason, setCloseReason] = useState('');
    const [chats, setChats] = useState<ChatSummary[]>(boot.chats);
    const [messages, setMessages] = useState<Record<string, ChatTextMessage[]>>(boot.messages);
    const [unread, setUnread] = useState<Record<string, number>>(boot.unread);
    const [openChatId, setOpenChatId] = useState(boot.openChatId);
    // which chat is on screen, readable from inside the message handler
    const openChatIdRef = useRef(boot.openChatId);
    const attached = useRef(false);

    // from here on the fake server talks to the page directly. Anything it said
    // between the bootstrap and this effect is waiting, and arrives now.
    useEffect(() => {
        if (attached.current) {
            return;
        }
        attached.current = true;
        net.attach({ onMessage, onClose });
        // the handlers only ever call setState, which never goes stale
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function onMessage(message: ServerMessage) {
        if (message.type === 'users') {
            setUsers(message.users);
            setArrivals(noteArrivals(seenIds.current, message.users));
        } else if (message.type === 'system') {
            setSystemLine(message.text);
        } else if (message.type === 'welcome') {
            setMyId(message.user_id);
            setJoinedName(message.user_name);
            setIsConnected(true);
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
    }

    function onClose(reason: string) {
        setIsConnected(false);
        setCloseReason(reason);
        // everything below belongs to a live connection, so it goes with it
        setUsers([]);
        setArrivals({});
        seenIds.current.clear();
        setSystemLine('');
        toast.dismiss();
        setJoinedName('');
        setMyId('');
        setChats([]);
        setMessages({});
        setUnread({});
        selectChat('');
    }

    function connect(name: string) {
        setCloseReason('');
        net.connect(name, { onMessage, onClose });
    }

    function disconnect() {
        net.disconnect();
    }

    function rename(name: string) {
        net.send({ type: 'rename', user_name: name });
    }

    function openChat(userId: string) {
        net.send({ type: 'open_chat', user_id: userId });
    }

    function selectChat(chatId: string) {
        openChatIdRef.current = chatId;
        setOpenChatId(chatId);
        setUnread((before) => ({ ...before, [chatId]: 0 }));
    }

    function sendMessage(chatId: string, text: string) {
        net.send({ type: 'send_message', chat_id: chatId, text });
    }

    // we're not in userIds: the server adds us, from the connection this arrived on
    function createGroup(userIds: string[], name: string) {
        net.send({ type: 'create_group', user_ids: userIds, name });
    }

    // no roles, so anyone in a group may do either of these
    function addMember(chatId: string, userId: string) {
        net.send({ type: 'add_member', chat_id: chatId, user_id: userId });
    }

    // passing our own id is how we leave
    function removeMember(chatId: string, userId: string) {
        net.send({ type: 'remove_member', chat_id: chatId, user_id: userId });
    }

    const realtime = {
        isConnected,
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
    };

    return (
        <RealtimeContext.Provider value={realtime}>
            <Notices />
            {children}
        </RealtimeContext.Provider>
    );
}
