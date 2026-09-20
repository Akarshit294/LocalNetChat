import { useEffect, useState } from 'react';
import { ReadyState } from 'react-use-websocket';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket';
import { api, WS_URL } from '../lib/api.ts';
import useDebounce from '../hooks/useDebounce';
import { validateUsername } from '../lib/validation.ts';
import JoinView from './JoinView.tsx';
import NameInput from './NameInput.tsx';

// Owns the socket and the name state, and decides which screen to show.
// The socket lives here so switching screens never drops the connection.
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

        if (debouncedName && !validateUsername(debouncedName)) {
            verifyUsername();
        }
    }, [debouncedName]);

    function handleNameChange(value: string) {
        setName(value);
        setReady(false);   // the old answer was about the old name
        setStatus('');
    }

    return(
        connect === false ?
            <JoinView
                name={name}
                onNameChange={handleNameChange}
                nameError={nameError}
                status={status}
                isConnected={readyState === ReadyState.OPEN}
                canConnect={nameError === null && ready}
                onConnect={() => setConnect(true)}
            /> :
            <>
                <p>Edit User Name</p>
                <NameInput value={name} onChange={handleNameChange} error={nameError} status={status} />
                <button onClick={() => setConnect(false)}>Disconnect</button>
            </>
    )
}