import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { validateUsername } from '../lib/validation.ts';
import useDebounce from './useDebounce';

// The name box: what's typed, whether it breaks a rule, and whether the server
// says it's free. Used on the join page and on the you page.
export default function useNameCheck(initialName: string = '') {
    const [name, setName] = useState(initialName);
    const [status, setStatus] = useState('');
    const [ready, setReady] = useState(false);
    const nameError = validateUsername(name);
    const debouncedName = useDebounce(name, 500);

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

    function changeName(value: string) {
        setName(value);
        setReady(false);   // the old answer was about the old name
        setStatus('');
    }

    return { name, changeName, nameError, status, ready };
}
