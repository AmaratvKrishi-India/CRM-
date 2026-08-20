/**
 * useSync Hook (Phase 2F)
 * Provides reactive sync state and manual trigger handlers in React components.
 */

import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from './syncEngine';
import { SyncState, SyncResult } from './syncTypes';

export function useSync() {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
      setIsSyncing(state.status === 'SYNCING');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const synchronizeNow = useCallback(async (): Promise<SyncResult | null> => {
    return await syncEngine.triggerSync();
  }, []);

  return {
    syncState,
    isSyncing,
    synchronizeNow,
  };
}
