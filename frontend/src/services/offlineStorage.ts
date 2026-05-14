/**
 * Offline Storage Service for Mobile Features
 * Extends IndexedDB storage with new feature data types
 * Handles read/write operations while offline with sync on reconnect
 */

import { initDB, saveToStore, getFromStore, getAllFromStore, deleteFromStore } from '../utils/indexedDB';

export type OfflineEntity = Record<string, unknown> & {
  id?: number | string;
  type?: string;
  _offlineSaved?: boolean;
  _lastModified?: string;
  _syncedAt?: string;
};

const asOfflineEntities = (records: unknown[]): OfflineEntity[] => records as OfflineEntity[];

// Extended store names for new features
export const MOBILE_STORES = {
  CLUBS: 'clubs',
  COMPETITIONS: 'competitions',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  TEAM_ANALYTICS: 'team_analytics',
  SCHEDULED_REPORTS: 'scheduled_reports',
  REPORT_TEMPLATES: 'report_templates',
  SERIES: 'series'
};

/**
 * Initialize mobile-specific IndexedDB stores
 * Called on app startup to ensure all stores exist
 */
export const initializeMobileStores = async (): Promise<void> => {
  try {
    const db = await initDB();
    const storesToCreate = Object.values(MOBILE_STORES);

    for (const storeName of storesToCreate) {
      if (!db.objectStoreNames.contains(storeName)) {
        // Stores will be created on onupgradeneeded
        // This is just verification
        console.log(`[OfflineStorage] Store ${storeName} will be created`);
      }
    }
  } catch (error) {
    console.error('[OfflineStorage] Failed to initialize mobile stores:', error);
  }
};

/**
 * Save club data offline
 */
export const saveClubOffline = async (club: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const data = {
      ...club,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.CLUBS, data);
    console.log('[OfflineStorage] Club saved:', club.id);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save club:', error);
    throw error;
  }
};

/**
 * Get clubs from offline storage
 */
export const getClubsOffline = async (): Promise<OfflineEntity[]> => {
  try {
    const clubs = await getAllFromStore(MOBILE_STORES.CLUBS);
    console.log('[OfflineStorage] Retrieved', clubs.length, 'clubs');
    return asOfflineEntities(clubs);
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve clubs:', error);
    return [];
  }
};

/**
 * Get single club from offline storage
 */
export const getClubOffline = async (clubId: number): Promise<OfflineEntity | null> => {
  try {
    const club = await getFromStore<OfflineEntity>(MOBILE_STORES.CLUBS, clubId);
    return club || null;
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve club:', error);
    return null;
  }
};

/**
 * Delete club from offline storage
 */
export const deleteClubOffline = async (clubId: number): Promise<void> => {
  try {
    await deleteFromStore(MOBILE_STORES.CLUBS, clubId);
    console.log('[OfflineStorage] Club deleted:', clubId);
  } catch (error) {
    console.error('[OfflineStorage] Failed to delete club:', error);
    throw error;
  }
};

/**
 * Save competition data offline
 */
export const saveCompetitionOffline = async (competition: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const data = {
      ...competition,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.COMPETITIONS, data);
    console.log('[OfflineStorage] Competition saved:', competition.id);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save competition:', error);
    throw error;
  }
};

/**
 * Get competitions from offline storage
 */
export const getCompetitionsOffline = async (): Promise<OfflineEntity[]> => {
  try {
    const competitions = await getAllFromStore(MOBILE_STORES.COMPETITIONS);
    console.log('[OfflineStorage] Retrieved', competitions.length, 'competitions');
    return asOfflineEntities(competitions);
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve competitions:', error);
    return [];
  }
};

/**
 * Save team analytics data offline
 */
export const saveTeamAnalyticsOffline = async (teamId: number, analytics: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const key = `team_${teamId}`;
    const data = {
      id: key,
      team_id: teamId,
      ...analytics,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.TEAM_ANALYTICS, data);
    console.log('[OfflineStorage] Team analytics saved for team:', teamId);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save team analytics:', error);
    throw error;
  }
};

/**
 * Get team analytics from offline storage
 */
export const getTeamAnalyticsOffline = async (teamId: number): Promise<OfflineEntity | null> => {
  try {
    const key = `team_${teamId}`;
    const analytics = await getFromStore<OfflineEntity>(MOBILE_STORES.TEAM_ANALYTICS, key);
    return analytics || null;
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve team analytics:', error);
    return null;
  }
};

/**
 * Save scheduled report offline
 */
export const saveScheduledReportOffline = async (report: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const data = {
      ...report,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.SCHEDULED_REPORTS, data);
    console.log('[OfflineStorage] Scheduled report saved:', report.id);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save scheduled report:', error);
    throw error;
  }
};

/**
 * Get scheduled reports from offline storage
 */
export const getScheduledReportsOffline = async (): Promise<OfflineEntity[]> => {
  try {
    const reports = await getAllFromStore(MOBILE_STORES.SCHEDULED_REPORTS);
    console.log('[OfflineStorage] Retrieved', reports.length, 'scheduled reports');
    return asOfflineEntities(reports);
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve scheduled reports:', error);
    return [];
  }
};

/**
 * Save report template offline
 */
export const saveReportTemplateOffline = async (template: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const data = {
      ...template,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.REPORT_TEMPLATES, data);
    console.log('[OfflineStorage] Report template saved:', template.id);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save report template:', error);
    throw error;
  }
};

/**
 * Get report templates from offline storage
 */
export const getReportTemplatesOffline = async (): Promise<OfflineEntity[]> => {
  try {
    const templates = await getAllFromStore(MOBILE_STORES.REPORT_TEMPLATES);
    console.log('[OfflineStorage] Retrieved', templates.length, 'report templates');
    return asOfflineEntities(templates);
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve report templates:', error);
    return [];
  }
};

/**
 * Save series/division offline
 */
export const saveSeriesOffline = async (series: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const data = {
      ...series,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.SERIES, data);
    console.log('[OfflineStorage] Series saved:', series.id);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save series:', error);
    throw error;
  }
};

/**
 * Get series/divisions from offline storage
 */
export const getSeriesOffline = async (): Promise<OfflineEntity[]> => {
  try {
    const seriesList = await getAllFromStore(MOBILE_STORES.SERIES);
    console.log('[OfflineStorage] Retrieved', seriesList.length, 'series');
    return asOfflineEntities(seriesList);
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve series:', error);
    return [];
  }
};

/**
 * Save advanced analytics offline
 */
export const saveAdvancedAnalyticsOffline = async (analyticsType: string, data: OfflineEntity): Promise<void> => {
  try {
    const timestamp = new Date().toISOString();
    const storageData = {
      id: `${analyticsType}_${Date.now()}`,
      type: analyticsType,
      ...data,
      _offlineSaved: true,
      _lastModified: timestamp
    };
    await saveToStore(MOBILE_STORES.ADVANCED_ANALYTICS, storageData);
    console.log('[OfflineStorage] Advanced analytics saved:', analyticsType);
  } catch (error) {
    console.error('[OfflineStorage] Failed to save advanced analytics:', error);
    throw error;
  }
};

/**
 * Get advanced analytics from offline storage by type
 */
export const getAdvancedAnalyticsOffline = async (analyticsType?: string): Promise<OfflineEntity[]> => {
  try {
    const analytics = await getAllFromStore<OfflineEntity>(MOBILE_STORES.ADVANCED_ANALYTICS);
    const filtered = analyticsType ? analytics.filter((a) => a.type === analyticsType) : analytics;
    console.log('[OfflineStorage] Retrieved', filtered.length, 'advanced analytics records');
    return filtered;
  } catch (error) {
    console.error('[OfflineStorage] Failed to retrieve advanced analytics:', error);
    return [];
  }
};

/**
 * Clear all offline data for a specific store
 */
export const clearOfflineStore = async (storeName: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[OfflineStorage] Store cleared:', storeName);
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear ${storeName}`));
      };
    });
  } catch (error) {
    console.error('[OfflineStorage] Failed to clear store:', error);
    throw error;
  }
};

/**
 * Get all offline-modified records from a store
 * Used during sync to identify what needs to be sent to backend
 */
export const getModifiedOfflineRecords = async (storeName: string): Promise<OfflineEntity[]> => {
  try {
    const records = await getAllFromStore<OfflineEntity>(storeName);
    const modified = records.filter((r) => r._offlineSaved === true);
    console.log('[OfflineStorage] Found', modified.length, 'modified records in', storeName);
    return modified;
  } catch (error) {
    console.error('[OfflineStorage] Failed to get modified records:', error);
    return [];
  }
};

/**
 * Clear offline modification flags after successful sync
 */
export const clearOfflineModificationFlags = async (storeName: string, recordId: number | string): Promise<void> => {
  try {
    const store = await getFromStore<OfflineEntity>(storeName, recordId);
    
    if (store) {
      const updated = {
        ...store,
        _offlineSaved: false,
        _syncedAt: new Date().toISOString()
      };
      await saveToStore(storeName, updated);
      console.log('[OfflineStorage] Cleared offline flags for:', recordId);
    }
  } catch (error) {
    console.error('[OfflineStorage] Failed to clear offline flags:', error);
  }
};
