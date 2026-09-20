import NameInput from './NameInput.tsx';

type JoinViewProps = {
    name: string;
    onNameChange: (name: string) => void;
    nameError: string | null;
    status: string;
    isConnected: boolean;
    canConnect: boolean;
    onConnect: () => void;
};

// The landing screen: pick a name, then connect.
export default function JoinView({ name, onNameChange, nameError, status, isConnected, canConnect, onConnect }: JoinViewProps) {
    return (
        <>
            <h1>WebSocket Test</h1>
            <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
            <NameInput value={name} onChange={onNameChange} error={nameError} status={status} />
            <button onClick={onConnect} disabled={!canConnect}>Connect</button>
        </>
    );
}
