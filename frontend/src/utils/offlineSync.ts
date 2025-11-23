/**
 * Offline Sync Manager
 * Handles queuing and syncing of offline actions when connection is restored
 */

import {
  queueOfflineAction,
  getUnsyncedActions,
  markActionSynced,
  clearOldSyncedActions
} from './indexedDB';

/**
 * Queue an action for later sync when offline
 */
export const queueAction = async (
  type: 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data: unknown
): Promise<void> => {
  await queueOfflineAction({
    type,
    endpoint,
    data,
    timestamp: Date.now()
  });

  // Trigger background sync if available
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-expect-error - Background Sync API is not in TypeScript types yet
      await registration.sync.register('sync-offline-actions');
      console.log('[OfflineSync] Background sync registered');
    } catch (error) {
      console.error('[OfflineSync] Failed to register background sync:', error);
    }
  }
};

/**
 * Process all pending offline actions
 */
export const processQueue = async (): Promise<{
  successful: number;
  failed: number;
  total: number;
}> => {
  const actions = await getUnsyncedActions();
  
  if (actions.length === 0) {
    console.log('[OfflineSync] No pending actions to sync');
    return { successful: 0, failed: 0, total: 0 };
  }

  console.log(`[OfflineSync] Processing ${actions.length} pending actions`);

  let successful = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      // Ensure data is properly formatted as string
      // If data is already a string, use it directly; otherwise stringify it
      let body: string | undefined;
      if (action.type !== 'DELETE') {
        body = typeof action.data === 'string' ? action.data : JSON.stringify(action.data);
      }

      const response = await fetch(action.endpoint, {
        method: action.type,
        headers: {
          'Content-Type': 'application/json',
          // Include auth token if available
          ...(localStorage.getItem('token') && {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          })
        },
        body
      });

      if (response.ok) {
        await markActionSynced(action.id);
        successful++;
        console.log(`[OfflineSync] Synced action ${action.id}: ${action.type} ${action.endpoint}`);
      } else {
        failed++;
        console.error(`[OfflineSync] Failed to sync action ${action.id}:`, response.status, response.statusText);
      }
    } catch (error) {
      failed++;
      console.error(`[OfflineSync] Error syncing action ${action.id}:`, error);
    }
  }

  // Clean up old synced actions
  await clearOldSyncedActions();

  console.log(`[OfflineSync] Sync complete: ${successful} successful, ${failed} failed out of ${actions.length} total`);

  return {
    successful,
    failed,
    total: actions.length
  };
};

/**
 * Retry failed actions
 */
export const retryFailedActions = async (): Promise<void> => {
  console.log('[OfflineSync] Retrying failed actions...');
  await processQueue();
};

/**
 * Get count of pending actions
 */
export const getPendingActionsCount = async (): Promise<number> => {
  const actions = await getUnsyncedActions();
  return actions.length;
};

/**
 * Listen for online event and sync automatically
 */
export const startAutoSync = (): void => {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
      console.log('[OfflineSync] Connection restored, syncing pending actions...');
      await processQueue();
      
      // Notify user via custom event
      window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    });

    console.log('[OfflineSync] Auto-sync listener started');
  }
};

/**
 * Stop auto-sync listener
 */
export const stopAutoSync = (): void => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', processQueue);
    console.log('[OfflineSync] Auto-sync listener stopped');
  }
};

export default {
  queueAction,
  processQueue,
  retryFailedActions,
  getPendingActionsCount,
  startAutoSync,
  stopAutoSync
};
