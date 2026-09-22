import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { FAKE } from '../lib/mode.ts';
import { Bar, Label, Page, Panel, PanelHeader } from '../ui/primitives.tsx';
import { color, type } from '../ui/theme.ts';

// The debug page. It asks the backend whether it is there, and says so.
export default function HealthPage() {
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

  const reachable = status !== 'unreachable' && status !== 'checking...';

  return (
    <Page>
      <Panel style={{ marginTop: 40 }}>
        <PanelHeader
          route="/health"
          meta={FAKE ? 'the fake server, in this tab' : 'the real backend, on port 8000'}
          hint="DEBUG"
        />
        <Bar style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              flex: '0 0 auto',
              background: reachable ? color.mint : color.inkFaint,
            }}
          />
          <span style={{ ...type.body }}>{status}</span>
        </Bar>
        <Label style={{ marginTop: 14 }}>
          {FAKE ? 'FAKING · ?fake=0 TO TALK TO THE REAL BACKEND' : 'ADD ?fake TO THE URL FOR A SERVER IN THIS TAB'}
        </Label>
      </Panel>
    </Page>
  );
}
