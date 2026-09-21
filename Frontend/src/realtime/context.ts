import { createContext, useContext } from 'react';
import type { ChatSummary, ChatTextMessage, ChatUser } from '../lib/messages.ts';

// What every page can read and do. The provider fills this in.
export type Realtime = {
    isConnected: boolean;
    closeReason: string;    // why the last connection ended, e.g. "Username already taken"
    myId: string;
    joinedName: string;
    users: ChatUser[];
    systemLine: string;
    errorLine: string;
    // chats
    chats: ChatSummary[];
    messages: Record<string, ChatTextMessage[]>;   // by chat id, only what arrived while we were here
    unread: Record<string, number>;                // by chat id
    openChatId: string;
    connect: (name: string) => void;
    disconnect: () => void;
    rename: (name: string) => void;
    openChat: (userId: string) => void;            // message this person
    selectChat: (chatId: string) => void;
    sendMessage: (chatId: string, text: string) => void;
    createGroup: (userIds: string[], name: string) => void;   // a group with us and these people
    addMember: (chatId: string, userId: string) => void;
    removeMember: (chatId: string, userId: string) => void;   // our own id means leaving
};

export const RealtimeContext = createContext<Realtime | null>(null);

export function useRealtime(): Realtime {
    const realtime = useContext(RealtimeContext);
    if (!realtime) {
        throw new Error('useRealtime must be used inside <RealtimeProvider>');
    }
    return realtime;
}
