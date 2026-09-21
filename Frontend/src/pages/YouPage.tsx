import { Link, Navigate } from 'react-router-dom';
import NameInput from '../components/NameInput.tsx';
import useNameCheck from '../hooks/useNameCheck';
import { useRealtime } from '../realtime/context.ts';

// Your own name, and the way out.
export default function YouPage() {
    const { isConnected, joinedName, errorLine, rename, disconnect } = useRealtime();
    const { name, changeName, nameError, status, ready } = useNameCheck(joinedName);

    if (!isConnected) {
        return <Navigate to="/" replace />;
    }

    // the name check counts us as holding our own name, so changing only its case
    // always reads as "unavailable". The server allows it, since it skips us by id.
    const isOwnName = name.trim().toLowerCase() === joinedName.toLowerCase();
    // nothing to rename to unless the name is valid, free, and actually different
    const canRename = nameError === null && name.trim() !== joinedName && (ready || isOwnName);

    return (
        <>
            <h1>You</h1>
            <NameInput value={name} onChange={changeName} error={nameError} status={status} />
            <button onClick={() => rename(name.trim())} disabled={!canRename}>Rename</button>
            <button onClick={disconnect}>Disconnect</button>
            {errorLine && <p>{errorLine}</p>}
            <Link to="/people">Around you</Link>
        </>
    );
}
