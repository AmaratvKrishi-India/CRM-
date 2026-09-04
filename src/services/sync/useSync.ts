/**
 * useSync Hook (Phase 2F)
 * Provides reactive sync state and manual trigger handlers in React components.
 */

import { useState, useEffect, useCallback } from 'react';
import { crmData } from '../../db';
import type { SyncState, SyncResult } from './syncTypes';

export function useSync() {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const engine = crmData.syncEngine;
    const unsubscribe = engine.subscribe((state) => {
      setSyncState(state);
      setIsSyncing(state.status === 'SYNCING');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const synchronizeNow = useCallback(async (): Promise<SyncResult | null> => {
    return await crmData.syncEngine.triggerSync();
  }, []);

  return {
    syncState,
    isSyncing,
    synchronizeNow,
  };
}
