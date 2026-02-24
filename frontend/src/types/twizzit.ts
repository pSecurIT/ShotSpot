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
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TwizzitSyncHistory {
  id: number;
  credentialId: number;
  syncType: 'teams' | 'players';
  status: 'success' | 'failed' | 'partial';
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errorMessage: string | null;
  syncedAt: string;
}

export interface TwizzitTeam {
  id: string;
  name: string;
  description?: string;
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
  credentialId: number;
  createdAt: string;
}

export interface PlayerMapping {
  id: number;
  internalPlayerId: number;
  internalPlayerName: string;
  twizzitPlayerId: string;
  twizzitPlayerName: string;
  credentialId: number;
  createdAt: string;
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
