import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';

export default function Health() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    async function checkHealth() {
      try {
        const data = await api.health();
        setStatus(data.status);
      } catch (err) {
        console.error('Health check failed:', err);
        setStatus('unreachable');
      }
    }
    checkHealth();
  }, []);

  return <h1>Backend: {status}</h1>;
}