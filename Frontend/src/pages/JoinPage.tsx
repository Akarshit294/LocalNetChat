import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NameInput from '../components/NameInput.tsx';
import useNameCheck from '../hooks/useNameCheck';
import { useRealtime } from '../realtime/context.ts';

// Pick a name and connect. Once the socket is open, move on to the people page.
export default function JoinPage() {
    const { isConnected, closeReason, connect } = useRealtime();
    const { name, changeName, nameError, status, ready } = useNameCheck();
    const navigate = useNavigate();

    useEffect(() => {
        if (isConnected) {
            navigate('/people');
        }
    }, [isConnected, navigate]);

    const canConnect = nameError === null && ready;

    return (
        <>
            <h1>Who are you?</h1>
            <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
            <NameInput value={name} onChange={changeName} error={nameError} status={status} />
            {closeReason && <p>{closeReason}</p>}
            <button onClick={() => connect(name.trim())} disabled={!canConnect}>Connect</button>
        </>
    );
}
