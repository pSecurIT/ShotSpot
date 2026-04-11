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
import { getCsrfToken } from './api';

const NON_SYNCABLE_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/csrf',
  '/twizzit/sync/'
];

let onlineSyncHandler: (() => void) | null = null;

type OfflineAction = {
  id: number;
  type: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data: unknown;
  timestamp: number;
  synced: boolean;
};

type ReplayAction = {
  action: OfflineAction;
  consumedActionIds: number[];
};

type MatchEventReplayMetadata = {
  resource: string;
  kind: 'create' | 'update' | 'confirm';
  clientUuid: string;
};

const normalizeEndpoint = (endpoint: string): string => {
  // Legacy queue entries may contain a removed preview endpoint.
  if (endpoint.includes('/twizzit/sync/preview/teams/')) {
    return endpoint.replace('/twizzit/sync/preview/teams/', '/twizzit/sync/teams/');
  }
  return endpoint;
};

const normalizePath = (endpoint: string): string => {
  try {
    return new URL(endpoint, 'http://localhost').pathname;
  } catch {
    return endpoint;
  }
};

const parseActionPayload = (data: unknown): { payload: Record<string, unknown> | null; wasString: boolean } => {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { payload: parsed as Record<string, unknown>, wasString: true };
      }
      return { payload: null, wasString: true };
    } catch {
      return { payload: null, wasString: true };
    }
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { payload: data as Record<string, unknown>, wasString: false };
  }

  return { payload: null, wasString: false };
};

const serializeActionPayload = (payload: Record<string, unknown>, wasString: boolean): unknown => {
  return wasString ? JSON.stringify(payload) : payload;
};

const getMatchEventReplayMetadata = (action: OfflineAction): MatchEventReplayMetadata | null => {
  const { payload } = parseActionPayload(action.data);
  const clientUuid = typeof payload?.client_uuid === 'string' ? payload.client_uuid : null;

  if (!clientUuid) {
    return null;
  }

  const normalizedPath = normalizePath(normalizeEndpoint(action.endpoint));
  const routePatterns = [
    { resource: 'shots', create: /^\/?api\/shots\/\d+$/, update: /^\/?api\/shots\/\d+\/\d+$/, confirm: /^\/?api\/shots\/\d+\/\d+\/confirm$/ },
    { resource: 'events', create: /^\/?api\/events\/\d+$/, update: /^\/?api\/events\/\d+\/\d+$/, confirm: /^\/?api\/events\/\d+\/\d+\/confirm$/ },
    { resource: 'substitutions', create: /^\/?api\/substitutions\/\d+$/, update: /^\/?api\/substitutions\/\d+\/\d+$/, confirm: /^\/?api\/substitutions\/\d+\/\d+\/confirm$/ },
    { resource: 'possessions', create: /^\/?api\/possessions\/\d+$/, update: /^\/?api\/possessions\/\d+\/\d+$/, confirm: /^\/?api\/possessions\/\d+\/\d+\/confirm$/ },
    { resource: 'free-shots', create: /^\/?api\/free-shots$/, update: /^\/?api\/free-shots\/\d+$/, confirm: /^\/?api\/free-shots\/\d+\/confirm$/ },
    { resource: 'timeouts', create: /^\/?api\/timeouts$/, update: /^\/?api\/timeouts\/\d+$/, confirm: /^\/?api\/timeouts\/\d+\/confirm$/ },
    { resource: 'match-commentary', create: /^\/?api\/match-commentary\/\d+$/, update: /^\/?api\/match-commentary\/\d+\/\d+$/, confirm: /^\/?api\/match-commentary\/\d+\/confirm$/ }
  ];

  for (const pattern of routePatterns) {
    if (action.type === 'POST' && pattern.create.test(normalizedPath)) {
      return { resource: pattern.resource, kind: 'create', clientUuid };
    }

    if (action.type === 'PUT' && pattern.update.test(normalizedPath)) {
      return { resource: pattern.resource, kind: 'update', clientUuid };
    }

    if (action.type === 'POST' && pattern.confirm.test(normalizedPath)) {
      return { resource: pattern.resource, kind: 'confirm', clientUuid };
    }
  }

  return null;
};

const mergeReplayActionIntoCreate = (createAction: OfflineAction, followUpAction: OfflineAction, followUpKind: 'update' | 'confirm'): OfflineAction => {
  const createPayloadResult = parseActionPayload(createAction.data);
  const followUpPayloadResult = parseActionPayload(followUpAction.data);

  if (!createPayloadResult.payload) {
    return createAction;
  }

  const mergedPayload = {
    ...createPayloadResult.payload,
    ...(followUpKind === 'update' && followUpPayloadResult.payload ? followUpPayloadResult.payload : {}),
    ...(followUpKind === 'confirm' ? { event_status: 'confirmed' } : {})
  };

  return {
    ...createAction,
    data: serializeActionPayload(mergedPayload, createPayloadResult.wasString)
  };
};

const buildReplayPlan = (actions: OfflineAction[]): ReplayAction[] => {
  const sortedActions = [...actions].sort((left, right) => left.timestamp - right.timestamp || left.id - right.id);
  const replayPlan: ReplayAction[] = [];
  const createActionIndexes = new Map<string, number>();

  for (const action of sortedActions) {
    const metadata = getMatchEventReplayMetadata(action);
    const replayKey = metadata ? `${metadata.resource}:${metadata.clientUuid}` : null;

    if (metadata?.kind === 'create' && replayKey) {
      createActionIndexes.set(replayKey, replayPlan.length);
      replayPlan.push({ action, consumedActionIds: [action.id] });
      continue;
    }

    if (metadata && replayKey && metadata.kind !== 'create') {
      const createActionIndex = createActionIndexes.get(replayKey);
      if (createActionIndex !== undefined) {
        const existingReplayAction = replayPlan[createActionIndex];
        replayPlan[createActionIndex] = {
          action: mergeReplayActionIntoCreate(existingReplayAction.action, action, metadata.kind),
          consumedActionIds: [...existingReplayAction.consumedActionIds, action.id]
        };
        continue;
      }
    }

    replayPlan.push({ action, consumedActionIds: [action.id] });
  }

  return replayPlan;
};

const isNonSyncableEndpoint = (endpoint: string): boolean => {
  return NON_SYNCABLE_ENDPOINTS.some(path => endpoint.includes(path));
};

const isUnrecoverableStatus = (status: number): boolean => {
  // Permanent request failures should not keep retrying forever.
  return [400, 401, 403, 404, 409, 422].includes(status);
};

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

  const replayPlan = buildReplayPlan(actions);

  let successful = 0;
  let failed = 0;

  for (const replayItem of replayPlan) {
    const action = replayItem.action;
    try {
      const endpoint = normalizeEndpoint(action.endpoint);

      if (isNonSyncableEndpoint(endpoint)) {
        for (const actionId of replayItem.consumedActionIds) {
          await markActionSynced(actionId);
        }
        successful += replayItem.consumedActionIds.length;
        console.warn(`[OfflineSync] Discarded non-syncable action ${action.id}: ${action.type} ${endpoint}`);
        continue;
      }

      // Ensure data is properly formatted as string
      // If data is already a string, use it directly; otherwise stringify it
      let body: string | undefined;
      if (action.type !== 'DELETE') {
        body = typeof action.data === 'string' ? action.data : JSON.stringify(action.data);
      }

      // Get CSRF token for state-changing requests
      const csrfToken = await getCsrfToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Include auth token if available
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Include CSRF token if available
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      const response = await fetch(endpoint, {
        method: action.type,
        headers,
        credentials: 'include', // Important: include cookies for session
        body
      });

      if (response.ok) {
        for (const actionId of replayItem.consumedActionIds) {
          await markActionSynced(actionId);
        }
        successful += replayItem.consumedActionIds.length;
        console.log(`[OfflineSync] Synced action ${action.id}: ${action.type} ${endpoint}`);
      } else {
        if (isUnrecoverableStatus(response.status)) {
          for (const actionId of replayItem.consumedActionIds) {
            await markActionSynced(actionId);
          }
          successful += replayItem.consumedActionIds.length;
          console.warn(
            `[OfflineSync] Discarded unrecoverable action ${action.id}:`,
            response.status,
            response.statusText,
            endpoint
          );
        } else {
          failed += replayItem.consumedActionIds.length;
          console.error(`[OfflineSync] Failed to sync action ${action.id}:`, response.status, response.statusText);
        }
      }
    } catch (error) {
      failed += replayItem.consumedActionIds.length;
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
    if (onlineSyncHandler) {
      window.removeEventListener('online', onlineSyncHandler);
    }

    onlineSyncHandler = async () => {
      console.log('[OfflineSync] Connection restored, syncing pending actions...');
      await processQueue();
      
      // Notify user via custom event
      window.dispatchEvent(new CustomEvent('offline-sync-complete'));
    };

    window.addEventListener('online', onlineSyncHandler);

    console.log('[OfflineSync] Auto-sync listener started');
  }
};

/**
 * Stop auto-sync listener
 */
export const stopAutoSync = (): void => {
  if (typeof window !== 'undefined' && onlineSyncHandler) {
    window.removeEventListener('online', onlineSyncHandler);
    onlineSyncHandler = null;
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
