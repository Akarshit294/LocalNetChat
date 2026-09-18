import { useEffect, useState } from 'react';

// Same machine that served this page, but port 8000
const API_URL = `http://${window.location.hostname}:8000`;

export default function Health() {
  const [status, setStatus] = useState('checking...');

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
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