import { useEffect, useRef, useState } from 'react';
import { fetchJson } from '../lib/api.js';

export function ConnectionStatus() {
  const [state, setState] = useState({ loading: false, message: 'Model result storage connection has not been checked.' });
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ loading: true, message: 'Checking connection…' });
    try {
      const data = await fetchJson('/api/database-status', { signal: controller.signal });
      if (!controller.signal.aborted) setState({ loading: false, message: data.connected
        ? 'Connected. Model result storage is ready.' : 'Connection unavailable.' });
    } catch (error) {
      if (!controller.signal.aborted) setState({ loading: false, message: error.code === 'SUPABASE_NOT_CONFIGURED'
        ? 'Connection setup is pending.' : 'Connection unavailable. Please try again later.' });
    }
  }
  return <div>
    <p id="databaseStatus" role="status" aria-live="polite">{state.message}</p>
    <button className="btn btn-outline" id="checkDatabase" type="button" disabled={state.loading} onClick={check}>Check data connection</button>
  </div>;
}
