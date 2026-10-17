import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { windowsJioProvider, windowsMockAllowed } from '../../services/calling/windowsJioProvider';

export function WindowsCallingSettings() {
  const { currentUser } = useAuth();
  const [, refresh] = useState(0);
  useEffect(() => windowsJioProvider.subscribe(() => refresh(value => value + 1)), []);
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Disabled by default. Pair this tab to enable the mock pilot.');
  if (!windowsMockAllowed(currentUser) || !currentUser) return null;
  const enabled = windowsJioProvider.isEnabled(currentUser);
  return <section aria-labelledby="windows-calling-title" className="p-3.5 rounded-2xl border border-line bg-surface space-y-3">
    <h3 id="windows-calling-title" className="text-sm font-bold text-ink">Windows JioFiber Calling — mock pilot</h3>
    <p className="text-xs text-soft">Simulated calls only. Real Jio calling is blocked by the upstream security review. No microphone, SIP credentials or recordings are collected.</p>
    <p role="status" className="text-sm text-ink">{message}</p>
    <p className="text-xs text-soft">{enabled ? 'Companion paired for this tab. SIP registered: no. Carrier call confirmed: no.' : 'Companion not paired. Service reachability has not been established.'}</p>
    {!enabled && <>
      <label className="block text-sm text-ink" htmlFor="companion-pairing">One-time code from your local companion</label>
      <input id="companion-pairing" type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} className="w-full rounded-xl border border-line bg-surface p-3 text-ink" />
      <label className="flex items-start gap-2 text-sm text-ink"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Enable simulated calling for my signed-in account on this tab. Each call requires my click.</label>
    </>}
    <button type="button" disabled={busy || (!enabled && (!consent || !code))} className="min-h-11 px-3 rounded-xl border border-line text-ink disabled:opacity-50" onClick={async () => {
      setBusy(true);
      try {
        if (enabled) { await windowsJioProvider.disconnect(); setMessage('Disabled and unpaired. Restart the companion for a new code.'); }
        else { await windowsJioProvider.pair(currentUser, code, consent); setMessage('Mock companion connected. No real call can be placed.'); }
      } catch { setMessage('Connection denied or unavailable. Check the local companion, browser permission and account scope, then retry manually.'); }
      finally { setCode(''); setConsent(false); setBusy(false); }
    }}>{enabled ? 'Disable and unpair' : 'Enable mock calling'}</button>
    <p className="text-xs text-soft">Refreshing, signing out or closing the tab requires pairing again. Stop with Ctrl+C in the companion terminal. Choose Bluetooth microphone and output separately in Windows Sound settings when a later authorized live pilot is available.</p>
  </section>;
}
