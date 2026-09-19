import { useEffect, useState } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { api, WS_URL } from '../lib/api.ts';
import useDebounce from '../hooks/useDebounce';
import { validateUsername } from '../lib/validation.ts';

export default function Home() {
    const [connect, setConnect] = useState(false);
    const [name, setName] = useState('');
    const [status, setStatus] = useState('');
    const [ready, setReady] = useState(false);
    const nameError = validateUsername(name);
    const debouncedName = useDebounce(name, 500);
    const ws_url = `${WS_URL}?username=${encodeURIComponent(name)}`;

    const { readyState } = useWebSocket(
        ws_url, 
        {  onClose: (event) => {
            setConnect(false);
            setStatus(event.reason);
        },}, 
        connect && !!name && !nameError
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

        if (debouncedName && !nameError) {
            verifyUsername();
        }
    }, [debouncedName, nameError]);

    return(
        connect === false ?
            <>
                <h1>WebSocket Test</h1>
                <p>Status: {readyState === ReadyState.OPEN ? 'Connected' : 'Disconnected'}</p>
                <input placeholder="Type user name..." value={name} onChange={(e) => setName(e.target.value)} />
                {name && nameError && <p>{nameError}</p>}
                {status && <p>Username status: {status}</p>}
                <button onClick={() => setConnect(true)} disabled={nameError !== null || !ready}>Connect</button>
            </> :
            <>
                <p>Edit User Name</p>
                <input placeholder="Type user name..." value={name} onChange={(e) => setName(e.target.value)} />
                {name && nameError && <p>{nameError}</p>}
                {status && <p>Username status: {status}</p>}
                <button onClick={() => setConnect(false)}>Disconnect</button>
            </>
    )
}