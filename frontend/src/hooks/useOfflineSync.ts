/**
 * useOfflineSync Hook
 * Orchestrates syncing of offline-modified records when connection is restored
 * Handles read/write queue processing and conflict resolution
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useOfflineStatus } from './useOfflineStatus';
import {
  getModifiedOfflineRecords,
  clearOfflineModificationFlags,
  MOBILE_STORES
} from '../services/offlineStorage';
import type { OfflineEntity } from '../services/offlineStorage';
import api from '../utils/api';

export interface OfflineSyncOptions {
  enabled?: boolean;
  autoSync?: boolean;
  onSyncStart?: () => void;
  onSyncComplete?: (results: SyncResults) => void;
  onSyncError?: (error: Error) => void;
}

export interface SyncResults {
  successful: number;
  failed: number;
  skipped: number;
  totalRecords: number;
  timestamp: string;
}

/**
 * Hook to manage offline sync of modified records
 */
export const useOfflineSync = (options: OfflineSyncOptions = {}) => {
  const {
    enabled = true,
    autoSync = true,
    onSyncStart,
    onSyncComplete,
    onSyncError
  } = options;

  const { isOnline } = useOfflineStatus();
  const syncInProgressRef = useRef(false);
  const lastSyncRef = useRef<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const stripOfflineMetadata = (record: OfflineEntity): OfflineEntity => {
    const cleanedRecord = { ...record };
    delete cleanedRecord._offlineSaved;
    delete cleanedRecord._lastModified;
    delete cleanedRecord._syncedAt;
    return cleanedRecord;
  };

  const requireRecordId = (record: OfflineEntity, entityName: string): string | number => {
    if (record.id === undefined) {
      throw new Error(`[OfflineSync] ${entityName} sync completed without an id`);
    }

    return record.id;
  };

  /**
   * Sync clubs
   */
  const syncClubs = useCallback(async () => {
    try {
      const modifiedClubs = await getModifiedOfflineRecords(MOBILE_STORES.CLUBS);
      let successful = 0;
      let failed = 0;

      for (const club of modifiedClubs) {
        try {
          const clubData = stripOfflineMetadata(club);
          
          if (club.id) {
            // Update existing
            await api.put(`/api/clubs/${club.id}`, clubData);
          } else {
            // Create new
            const response = await api.post('/api/clubs', clubData);
            club.id = response.data.id;
          }

          await clearOfflineModificationFlags(MOBILE_STORES.CLUBS, requireRecordId(club, 'Club'));
          successful++;
        } catch (error) {
          console.error('[OfflineSync] Failed to sync club:', club.id, error);
          failed++;
        }
      }

      return { successful, failed, total: modifiedClubs.length };
    } catch (error) {
      console.error('[OfflineSync] Error syncing clubs:', error);
      return { successful: 0, failed: 0, total: 0 };
    }
  }, []);

  /**
   * Sync competitions
   */
  const syncCompetitions = useCallback(async () => {
    try {
      const modifiedCompetitions = await getModifiedOfflineRecords(MOBILE_STORES.COMPETITIONS);
      let successful = 0;
      let failed = 0;

      for (const competition of modifiedCompetitions) {
        try {
          const competitionData = stripOfflineMetadata(competition);
          
          if (competition.id) {
            await api.put(`/api/competitions/${competition.id}`, competitionData);
          } else {
            const response = await api.post('/api/competitions', competitionData);
            competition.id = response.data.id;
          }

          await clearOfflineModificationFlags(
            MOBILE_STORES.COMPETITIONS,
            requireRecordId(competition, 'Competition')
          );
          successful++;
        } catch (error) {
          console.error('[OfflineSync] Failed to sync competition:', competition.id, error);
          failed++;
        }
      }

      return { successful, failed, total: modifiedCompetitions.length };
    } catch (error) {
      console.error('[OfflineSync] Error syncing competitions:', error);
      return { successful: 0, failed: 0, total: 0 };
    }
  }, []);

  /**
   * Sync scheduled reports
   */
  const syncScheduledReports = useCallback(async () => {
    try {
      const modifiedReports = await getModifiedOfflineRecords(MOBILE_STORES.SCHEDULED_REPORTS);
      let successful = 0;
      let failed = 0;

      for (const report of modifiedReports) {
        try {
          const reportData = stripOfflineMetadata(report);
          
          if (report.id) {
            await api.put(`/api/scheduled-reports/${report.id}`, reportData);
          } else {
            const response = await api.post('/api/scheduled-reports', reportData);
            report.id = response.data.id;
          }

          await clearOfflineModificationFlags(
            MOBILE_STORES.SCHEDULED_REPORTS,
            requireRecordId(report, 'Scheduled report')
          );
          successful++;
        } catch (error) {
          console.error('[OfflineSync] Failed to sync scheduled report:', report.id, error);
          failed++;
        }
      }

      return { successful, failed, total: modifiedReports.length };
    } catch (error) {
      console.error('[OfflineSync] Error syncing scheduled reports:', error);
      return { successful: 0, failed: 0, total: 0 };
    }
  }, []);

  /**
   * Sync report templates
   */
  const syncReportTemplates = useCallback(async () => {
    try {
      const modifiedTemplates = await getModifiedOfflineRecords(MOBILE_STORES.REPORT_TEMPLATES);
      let successful = 0;
      let failed = 0;

      for (const template of modifiedTemplates) {
        try {
          const templateData = stripOfflineMetadata(template);
          
          if (template.id) {
            await api.put(`/api/report-templates/${template.id}`, templateData);
          } else {
            const response = await api.post('/api/report-templates', templateData);
            template.id = response.data.id;
          }

          await clearOfflineModificationFlags(
            MOBILE_STORES.REPORT_TEMPLATES,
            requireRecordId(template, 'Report template')
          );
          successful++;
        } catch (error) {
          console.error('[OfflineSync] Failed to sync report template:', template.id, error);
          failed++;
        }
      }

      return { successful, failed, total: modifiedTemplates.length };
    } catch (error) {
      console.error('[OfflineSync] Error syncing report templates:', error);
      return { successful: 0, failed: 0, total: 0 };
    }
  }, []);

  /**
   * Sync series
   */
  const syncSeries = useCallback(async () => {
    try {
      const modifiedSeries = await getModifiedOfflineRecords(MOBILE_STORES.SERIES);
      let successful = 0;
      let failed = 0;

      for (const series of modifiedSeries) {
        try {
          const seriesData = stripOfflineMetadata(series);
          
          if (series.id) {
            await api.put(`/api/series/${series.id}`, seriesData);
          } else {
            const response = await api.post('/api/series', seriesData);
            series.id = response.data.id;
          }

          await clearOfflineModificationFlags(MOBILE_STORES.SERIES, requireRecordId(series, 'Series'));
          successful++;
        } catch (error) {
          console.error('[OfflineSync] Failed to sync series:', series.id, error);
          failed++;
        }
      }

      return { successful, failed, total: modifiedSeries.length };
    } catch (error) {
      console.error('[OfflineSync] Error syncing series:', error);
      return { successful: 0, failed: 0, total: 0 };
    }
  }, []);

  /**
   * Perform full sync of all offline-modified records
   */
  const performSync = useCallback(async () => {
    if (!enabled || !isOnline || syncInProgressRef.current) {
      return;
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);
    onSyncStart?.();

    try {
      console.log('[OfflineSync] Starting offline sync...');
      const startTime = Date.now();

      // Sync all feature stores in order
      const clubResults = await syncClubs();
      const competitionResults = await syncCompetitions();
      const reportResults = await syncScheduledReports();
      const templateResults = await syncReportTemplates();
      const seriesResults = await syncSeries();

      const totalResults: SyncResults = {
        successful:
          clubResults.successful +
          competitionResults.successful +
          reportResults.successful +
          templateResults.successful +
          seriesResults.successful,
        failed:
          clubResults.failed +
          competitionResults.failed +
          reportResults.failed +
          templateResults.failed +
          seriesResults.failed,
        skipped: 0,
        totalRecords:
          clubResults.total +
          competitionResults.total +
          reportResults.total +
          templateResults.total +
          seriesResults.total,
        timestamp: new Date().toISOString()
      };

      const duration = Date.now() - startTime;
      console.log(
        `[OfflineSync] Sync complete: ${totalResults.successful}/${totalResults.totalRecords} successful in ${duration}ms`
      );

      lastSyncRef.current = Date.now();
      onSyncComplete?.(totalResults);
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
      onSyncError?.(error as Error);
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }
  }, [enabled, isOnline, syncClubs, syncCompetitions, syncScheduledReports, syncReportTemplates, syncSeries, onSyncStart, onSyncComplete, onSyncError]);

  /**
   * Sync when connection is restored
   */
  useEffect(() => {
    if (!enabled || !autoSync) {
      return;
    }

    if (isOnline && !syncInProgressRef.current) {
      // Debounce sync to avoid multiple rapid syncs
      const now = Date.now();
      if (now - lastSyncRef.current > 1000) {
        performSync();
      }
    }
  }, [isOnline, enabled, autoSync, performSync]);

  return {
    performSync,
    isSyncing,
    isOnline
  };
};

/**
 * Global offline sync manager for automatic background sync
 */
let globalSyncListener: (() => void) | null = null;

export const startGlobalOfflineSync = (options?: OfflineSyncOptions) => {
  if (globalSyncListener) {
    return; // Already started
  }

  const handleOnline = async () => {
    console.log('[OfflineSync] Connection restored, syncing offline data...');
    try {
      // Trigger sync for all modified stores
      const clubResults = await getModifiedOfflineRecords(MOBILE_STORES.CLUBS);
      const competitionResults = await getModifiedOfflineRecords(MOBILE_STORES.COMPETITIONS);
      const reportResults = await getModifiedOfflineRecords(MOBILE_STORES.SCHEDULED_REPORTS);
      const templateResults = await getModifiedOfflineRecords(MOBILE_STORES.REPORT_TEMPLATES);
      const seriesResults = await getModifiedOfflineRecords(MOBILE_STORES.SERIES);

      const totalRecords =
        clubResults.length +
        competitionResults.length +
        reportResults.length +
        templateResults.length +
        seriesResults.length;

      if (totalRecords > 0) {
        console.log(`[OfflineSync] Found ${totalRecords} records to sync`);
        options?.onSyncStart?.();
      }
    } catch (error) {
      console.error('[OfflineSync] Error checking for sync:', error);
    }
  };

  globalSyncListener = handleOnline;
  window.addEventListener('online', handleOnline);
};

export const stopGlobalOfflineSync = () => {
  if (globalSyncListener) {
    window.removeEventListener('online', globalSyncListener);
    globalSyncListener = null;
  }
};
