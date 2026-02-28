export interface TwizzitCredential {
  id: number;
  apiUsername: string;
  organizationName: string;
  apiEndpoint?: string;
  isActive?: boolean;
  lastVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface TwizzitSyncConfig {
  id: number;
  credentialId: number;
  autoSyncEnabled: boolean;
  syncIntervalHours: number;
  syncIntervalDays?: number;
  syncIntervalUnit?: 'hours' | 'days';
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TwizzitSyncHistory {
  id: number;
  credentialId: number;
  syncType: 'teams' | 'players';
  syncDirection?: string;
  status: 'success' | 'failed' | 'partial';
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errorMessage: string | null;
  syncedAt: string;
  startedAt?: string;
  completedAt?: string | null;
}

export interface TwizzitTeam {
  id: string;
  name: string;
  description?: string;
}

export interface TwizzitGroup {
  id: string;
  name: string;
  description?: string;
}

export interface TwizzitSeason {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

export interface TwizzitPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  teamId?: string;
}

export interface TeamMapping {
  id: number;
  internalTeamId: number;
  internalTeamName: string;
  twizzitTeamId: string;
  twizzitTeamName: string;
  lastSyncedAt: string | null;
  syncStatus: string;
  syncError?: string | null;
}

export interface PlayerMapping {
  id: number;
  internalPlayerId: number;
  internalPlayerName: string;
  internalPlayerFirstName?: string;
  internalPlayerLastName?: string;
  jerseyNumber?: number;
  twizzitPlayerId: string;
  twizzitPlayerName: string;
  internalTeamId: number;
  internalTeamName: string;
  lastSyncedAt: string | null;
  syncStatus: string;
  syncError?: string | null;
}

export interface SyncResult {
  message: string;
  teamsCreated?: number;
  playersCreated?: number;
  errors?: string[];
}

export interface VerifyConnectionResult {
  success: boolean;
  message: string;
  organizationName?: string;
}
