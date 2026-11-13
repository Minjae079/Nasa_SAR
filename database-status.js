const button = document.getElementById('checkDatabase');
const status = document.getElementById('databaseStatus');
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Checking connection…';
  try {
    const response = await fetch('/api/database-status', { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    const result = await response.json();
    status.textContent = response.ok && result.connected
      ? 'Connected. Analysis database and file storage are ready.'
      : result.error === 'SUPABASE_NOT_CONFIGURED'
        ? 'Connection setup is pending.' : 'Connection unavailable. Please try again later.';
  } catch { status.textContent = 'Connection unavailable. Please try again later.'; }
  finally { button.disabled = false; }
});
