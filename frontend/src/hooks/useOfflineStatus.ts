/**
 * useOfflineStatus Hook
 * Tracks online/offline state, syncing status, and pending actions count
 */

import { useState, useEffect, useCallback } from 'react';
import { getPendingActionsCount, processQueue } from '../utils/offlineSync';

interface OfflineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  lastSyncTime: number | null;
}

export const useOfflineStatus = () => {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingActions: 0,
    lastSyncTime: null
  });

  // Update online/offline status
  const updateOnlineStatus = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }));
  }, []);

  // Update pending actions count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingActionsCount();
      setStatus(prev => ({
        ...prev,
        pendingActions: count
      }));
    } catch (error) {
      console.error('[useOfflineStatus] Failed to get pending count:', error);
    }
  }, []);

  // Trigger manual sync
  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('[useOfflineStatus] Cannot sync while offline');
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      await processQueue();
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now()
      }));
      // Update pending count after sync
      await updatePendingCount();
    } catch (error) {
      console.error('[useOfflineStatus] Sync failed:', error);
      setStatus(prev => ({ ...prev, isSyncing: false }));
    }
  }, [updatePendingCount]);

  // Handle sync complete event
  useEffect(() => {
    const handleSyncComplete = () => {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now()
      }));
      updatePendingCount();
    };

    window.addEventListener('offline-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('offline-sync-complete', handleSyncComplete);
    };
  }, [updatePendingCount]);

  // Listen for online/offline events
  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  // Listen for service worker messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_START') {
          setStatus(prev => ({ ...prev, isSyncing: true }));
        } else if (event.data?.type === 'SYNC_COMPLETE') {
          setStatus(prev => ({
            ...prev,
            isSyncing: false,
            lastSyncTime: Date.now()
          }));
          updatePendingCount();
        }
      });
    }
  }, [updatePendingCount]);

  // Update pending count on mount and when coming back online
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePendingCount();
  }, [updatePendingCount]);

  useEffect(() => {
    if (status.isOnline) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      updatePendingCount();
    }
  }, [status.isOnline, updatePendingCount]);

  return {
    ...status,
    sync
  };
};

export default useOfflineStatus;
