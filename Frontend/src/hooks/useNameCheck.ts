import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { validateUsername } from '../lib/validation.ts';
import useDebounce from './useDebounce';

// The name box: what's typed, whether it breaks a rule, and whether the server
// says it's free. Used on the join page and on the you page.
export default function useNameCheck(initialName: string = '') {
    const [name, setName] = useState(initialName);
    // The server's last answer, and the name it was about. It only counts while
    // that name is still the one in the box: an answer about what you typed a
    // moment ago says nothing about what's there now.
    const [answer, setAnswer] = useState({ name: '', status: '' });
    const nameError = validateUsername(name);
    const debouncedName = useDebounce(name, 500);

    useEffect(() => {
        // a newer check replaces this one, and if this one's answer comes back
        // last it would overwrite the newer answer, so it's dropped
        let replaced = false;

        async function verifyUsername() {
            setAnswer({ name: debouncedName, status: 'checking...' });
            try {
                const data = await api.verifyUsername(debouncedName);
                if (!replaced) {
                    setAnswer({ name: debouncedName, status: data.available ? 'available' : 'unavailable' });
                }
            } catch (err) {
                console.error('Username verification failed:', err);
                if (!replaced) {
                    setAnswer({ name: debouncedName, status: 'unreachable' });
                }
            }
        }

        if (debouncedName && !validateUsername(debouncedName)) {
            verifyUsername();
        }
        return () => {
            replaced = true;
        };
    }, [debouncedName]);

    // Only a hint: both pages let a name through while it's still being checked,
    // because the server checks again and says why if it refuses.
    return {
        name,
        changeName: setName,
        nameError,
        status: answer.name === name ? answer.status : '',
    };
}
