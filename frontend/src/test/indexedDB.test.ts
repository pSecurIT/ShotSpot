/**
 * Tests for IndexedDB Storage Utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initDB,
  saveToStore,
  saveMultipleToStore,
  getFromStore,
  getAllFromStore,
  getByIndex,
  deleteFromStore,
  clearStore,
  queueOfflineAction,
  getUnsyncedActions,
  markActionSynced,
  clearOldSyncedActions,
  STORES
} from '../utils/indexedDB';

describe('IndexedDB Utility', () => {
  beforeEach(async () => {
    // Clear all stores before each test
    await initDB();
    const stores = [
      STORES.GAMES,
      STORES.SHOTS,
      STORES.EVENTS,
      STORES.SUBSTITUTIONS,
      STORES.TEAMS,
      STORES.PLAYERS,
      STORES.SYNC_QUEUE
    ];

    for (const storeName of stores) {
      await clearStore(storeName);
    }
  });

  afterEach(async () => {
    // Clean up after tests
    const db = await initDB();
    db.close();
  });

  describe('initDB', () => {
    it('should initialize the database', async () => {
      const db = await initDB();
      expect(db).toBeDefined();
      expect(db.name).toBe('ShotSpotOfflineDB');
      expect(db.version).toBe(1);
    });

    it('should create all required object stores', async () => {
      const db = await initDB();
      const storeNames = Array.from(db.objectStoreNames);
      
      expect(storeNames).toContain(STORES.GAMES);
      expect(storeNames).toContain(STORES.SHOTS);
      expect(storeNames).toContain(STORES.EVENTS);
      expect(storeNames).toContain(STORES.SUBSTITUTIONS);
      expect(storeNames).toContain(STORES.TEAMS);
      expect(storeNames).toContain(STORES.PLAYERS);
      expect(storeNames).toContain(STORES.SYNC_QUEUE);
    });
  });

  describe('saveToStore', () => {
    it('should save data to a store', async () => {
      const team = { id: 1, name: 'Test Team', created_at: new Date().toISOString() };
      
      await saveToStore(STORES.TEAMS, team);
      
      const retrieved = await getFromStore<typeof team>(STORES.TEAMS, 1);
      expect(retrieved).toEqual(team);
    });

    it('should update existing data with same key', async () => {
      const team = { id: 1, name: 'Original Team', created_at: new Date().toISOString() };
      await saveToStore(STORES.TEAMS, team);
      
      const updatedTeam = { id: 1, name: 'Updated Team', created_at: new Date().toISOString() };
      await saveToStore(STORES.TEAMS, updatedTeam);
      
      const retrieved = await getFromStore<typeof team>(STORES.TEAMS, 1);
      expect(retrieved?.name).toBe('Updated Team');
    });
  });

  describe('saveMultipleToStore', () => {
    it('should save multiple items to a store', async () => {
      const players = [
        { id: 1, name: 'Player 1', team_id: 1, jersey_number: 1 },
        { id: 2, name: 'Player 2', team_id: 1, jersey_number: 2 },
        { id: 3, name: 'Player 3', team_id: 1, jersey_number: 3 }
      ];
      
      await saveMultipleToStore(STORES.PLAYERS, players);
      
      const allPlayers = await getAllFromStore<typeof players[0]>(STORES.PLAYERS);
      expect(allPlayers).toHaveLength(3);
      expect(allPlayers.map(p => p.name)).toEqual(['Player 1', 'Player 2', 'Player 3']);
    });
  });

  describe('getFromStore', () => {
    it('should retrieve data by key', async () => {
      const game = { id: 100, home_team_id: 1, away_team_id: 2, date: '2024-12-01' };
      await saveToStore(STORES.GAMES, game);
      
      const retrieved = await getFromStore<typeof game>(STORES.GAMES, 100);
      expect(retrieved).toEqual(game);
    });

    it('should return undefined for non-existent key', async () => {
      const retrieved = await getFromStore(STORES.TEAMS, 999);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllFromStore', () => {
    it('should retrieve all data from a store', async () => {
      const teams = [
        { id: 1, name: 'Team A' },
        { id: 2, name: 'Team B' },
        { id: 3, name: 'Team C' }
      ];
      
      for (const team of teams) {
        await saveToStore(STORES.TEAMS, team);
      }
      
      const allTeams = await getAllFromStore<typeof teams[0]>(STORES.TEAMS);
      expect(allTeams).toHaveLength(3);
    });

    it('should return empty array for empty store', async () => {
      const result = await getAllFromStore(STORES.TEAMS);
      expect(result).toEqual([]);
    });
  });

  describe('getByIndex', () => {
    it('should retrieve data by index', async () => {
      const shots = [
        { id: 1, game_id: 100, player_id: 1, result: 'goal' },
        { id: 2, game_id: 100, player_id: 2, result: 'miss' },
        { id: 3, game_id: 200, player_id: 1, result: 'goal' }
      ];
      
      for (const shot of shots) {
        await saveToStore(STORES.SHOTS, shot);
      }
      
      const game100Shots = await getByIndex<typeof shots[0]>(STORES.SHOTS, 'gameId', 100);
      expect(game100Shots).toHaveLength(2);
      expect(game100Shots.every(s => s.game_id === 100)).toBe(true);
    });
  });

  describe('deleteFromStore', () => {
    it('should delete data from a store', async () => {
      const team = { id: 1, name: 'Test Team' };
      await saveToStore(STORES.TEAMS, team);
      
      await deleteFromStore(STORES.TEAMS, 1);
      
      const retrieved = await getFromStore(STORES.TEAMS, 1);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('clearStore', () => {
    it('should clear all data from a store', async () => {
      const teams = [
        { id: 1, name: 'Team A' },
        { id: 2, name: 'Team B' },
        { id: 3, name: 'Team C' }
      ];
      
      for (const team of teams) {
        await saveToStore(STORES.TEAMS, team);
      }
      
      await clearStore(STORES.TEAMS);
      
      const allTeams = await getAllFromStore(STORES.TEAMS);
      expect(allTeams).toEqual([]);
    });
  });

  describe('Offline Action Queue', () => {
    describe('queueOfflineAction', () => {
      it('should queue an offline action', async () => {
        await queueOfflineAction({
          type: 'POST',
          endpoint: '/api/shots',
          data: { player_id: 1, result: 'goal' },
          timestamp: Date.now()
        });
        
        const actions = await getUnsyncedActions();
        expect(actions).toHaveLength(1);
        expect(actions[0].type).toBe('POST');
        expect(actions[0].endpoint).toBe('/api/shots');
        expect(actions[0].synced).toBe(false);
      });

      it('should queue multiple actions', async () => {
        await queueOfflineAction({
          type: 'POST',
          endpoint: '/api/shots',
          data: { player_id: 1 },
          timestamp: Date.now()
        });
        
        await queueOfflineAction({
          type: 'PUT',
          endpoint: '/api/teams/1',
          data: { name: 'Updated Team' },
          timestamp: Date.now()
        });
        
        const actions = await getUnsyncedActions();
        expect(actions).toHaveLength(2);
      });
    });

    describe('getUnsyncedActions', () => {
      it('should return only unsynced actions', async () => {
        // Add unsynced action
        await queueOfflineAction({
          type: 'POST',
          endpoint: '/api/shots',
          data: { player_id: 1 },
          timestamp: Date.now()
        });
        
        // Add synced action
        const syncedAction = {
          id: 2,
          type: 'POST' as const,
          endpoint: '/api/teams',
          data: { name: 'Team' },
          timestamp: Date.now(),
          synced: true
        };
        await saveToStore(STORES.SYNC_QUEUE, syncedAction);
        
        const unsynced = await getUnsyncedActions();
        expect(unsynced).toHaveLength(1);
        expect(unsynced[0].synced).toBe(false);
      });

      it('should return empty array when no unsynced actions', async () => {
        const unsynced = await getUnsyncedActions();
        expect(unsynced).toEqual([]);
      });
    });

    describe('markActionSynced', () => {
      it('should mark an action as synced', async () => {
        await queueOfflineAction({
          type: 'POST',
          endpoint: '/api/shots',
          data: { player_id: 1 },
          timestamp: Date.now()
        });
        
        const actions = await getUnsyncedActions();
        const actionId = actions[0].id;
        
        await markActionSynced(actionId);
        
        const action = await getFromStore<{synced: boolean}>(STORES.SYNC_QUEUE, actionId);
        expect(action?.synced).toBe(true);
      });

      it('should not throw error for non-existent action', async () => {
        await expect(markActionSynced(999)).resolves.not.toThrow();
      });
    });

    describe('clearOldSyncedActions', () => {
      it('should clear synced actions older than 7 days', async () => {
        const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
        
        // Old synced action (should be deleted)
        const oldSyncedAction = {
          id: 1,
          type: 'POST' as const,
          endpoint: '/api/old',
          data: {},
          timestamp: eightDaysAgo,
          synced: true
        };
        await saveToStore(STORES.SYNC_QUEUE, oldSyncedAction);
        
        // Recent synced action (should remain)
        const recentSyncedAction = {
          id: 2,
          type: 'POST' as const,
          endpoint: '/api/recent',
          data: {},
          timestamp: Date.now(),
          synced: true
        };
        await saveToStore(STORES.SYNC_QUEUE, recentSyncedAction);
        
        // Old unsynced action (should remain)
        await queueOfflineAction({
          type: 'POST',
          endpoint: '/api/unsynced',
          data: {},
          timestamp: eightDaysAgo
        });
        
        await clearOldSyncedActions();
        
        const allActions = await getAllFromStore<{id: number}>(STORES.SYNC_QUEUE);
        expect(allActions).toHaveLength(2); // Recent synced + old unsynced
        expect(allActions.find(a => a.id === 1)).toBeUndefined(); // Old synced deleted
        expect(allActions.find(a => a.id === 2)).toBeDefined(); // Recent synced remains
      });
    });
  });
});
