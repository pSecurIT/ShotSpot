/**
 * OfflineIndicator Component
 * Visual indicator showing connection status and sync progress
 */

import React from 'react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

const OfflineIndicator: React.FC = () => {
  const { isOnline, isSyncing, pendingActions, sync } = useOfflineStatus();

  // Don't show anything if online with no pending actions
  if (isOnline && !isSyncing && pendingActions === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isSyncing) return 'bg-yellow-500';
    if (pendingActions > 0) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (pendingActions > 0) return `${pendingActions} pending action${pendingActions > 1 ? 's' : ''}`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '⚠️';
    if (isSyncing) return '🔄';
    if (pendingActions > 0) return '⏳';
    return '✓';
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-white ${getStatusColor()} transition-all duration-300`}
      >
        <span className="text-lg" aria-label={getStatusText()}>
          {getStatusIcon()}
        </span>
        <span className="font-medium text-sm">
          {getStatusText()}
        </span>
        
        {/* Sync button when there are pending actions and we're online */}
        {isOnline && pendingActions > 0 && !isSyncing && (
          <button
            onClick={sync}
            className="ml-2 px-2 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-xs font-semibold transition-all"
            aria-label="Sync pending actions"
          >
            Sync Now
          </button>
        )}
      </div>

      {/* Loading spinner when syncing */}
      {isSyncing && (
        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
      )}
    </div>
  );
};

export default OfflineIndicator;
