import { useCallback, useEffect, useMemo, useState } from 'react';
import { crmData } from '../../db';
import { recoveryGuidance, SyncRecoveryService } from '../../services/sync/syncRecoveryService';
import type { OutboxItem } from '../../services/sync/syncTypes';

export function SyncRecoveryPanel() {
  const service = useMemo(() => new SyncRecoveryService(crmData.db), []);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exportText, setExportText] = useState('');
  const load = useCallback(async () => {
    const page = await service.list(offset);
    setItems(page.items);
    setHasMore(page.hasMore);
  }, [service, offset]);
  useEffect(() => { void load().catch(() => setError('Could not load saved changes. Reopen Settings to try again.')); }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Recovery action failed.'); }
    finally { setBusy(false); }
  }

  return <section aria-label="Saved changes needing attention" className="p-3.5 rounded-2xl border border-line bg-surface space-y-3">
    <h3 className="text-sm font-bold text-ink">Saved changes needing attention</h3>
    <p className="text-xs text-soft">Failed changes stay on this device until recovered. Export them before clearing app storage or changing devices.</p>
    {error && <p role="alert" className="text-xs text-danger-text">{error}</p>}
    {items.length === 0 && <p className="text-xs text-soft">No saved changes on this page need attention.</p>}
    {items.map(item => <article key={item.id} className="space-y-2 border-t border-line pt-3">
      <p className="text-sm font-semibold text-ink">{item.entityType} · {item.operation}</p>
      <p className="text-xs text-soft break-all">Record: {item.entityId}</p>
      <p className="text-xs text-soft">{recoveryGuidance(item.lastError)}</p>
      <details className="text-xs"><summary>Inspect saved change</summary>
        <pre className="whitespace-pre-wrap break-all max-h-48 overflow-auto">{JSON.stringify({ error: item.lastError, payload: item.payload }, null, 2)}</pre>
      </details>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="btn-secondary" onClick={() => void run(async () => { setExportText(await service.exportItem(item.id)); })}>Export saved change</button>
        <button type="button" disabled={busy} className="btn-secondary" onClick={() => void run(async () => { await service.retry(item.id); setExportText(''); await load(); })}>Retry unchanged</button>
      </div>
    </article>)}
    {exportText && <label className="block text-xs text-soft">Recovery export — select and copy to a private file. It contains your saved business data.
      <textarea aria-label="Recovery export" readOnly value={exportText} onFocus={event => event.currentTarget.select()} className="w-full h-40 mt-2 p-2 bg-surface border border-line rounded-lg" />
    </label>}
    <div className="flex gap-2">
      <button type="button" className="btn-secondary" disabled={busy || offset === 0} onClick={() => { setExportText(''); setOffset(Math.max(0, offset - 20)); }}>Previous</button>
      <button type="button" className="btn-secondary" disabled={busy || !hasMore} onClick={() => { setExportText(''); setOffset(offset + 20); }}>Next</button>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void run(load)}>Refresh</button>
    </div>
  </section>;
}
