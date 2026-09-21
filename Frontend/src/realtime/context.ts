import { createContext, useContext } from 'react';
import type { ChatUser } from '../lib/messages.ts';

// What every page can read and do. The provider fills this in.
export type Realtime = {
    isConnected: boolean;
    closeReason: string;    // why the last connection ended, e.g. "Username already taken"
    myId: string;
    joinedName: string;
    users: ChatUser[];
    systemLine: string;
    errorLine: string;
    connect: (name: string) => void;
    disconnect: () => void;
    rename: (name: string) => void;
};

export const RealtimeContext = createContext<Realtime | null>(null);

export function useRealtime(): Realtime {
    const realtime = useContext(RealtimeContext);
    if (!realtime) {
        throw new Error('useRealtime must be used inside <RealtimeProvider>');
    }
    return realtime;
}
