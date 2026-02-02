export interface TwizzitCredential {
  id: number;
  organizationName: string;
  apiUsername: string;
  apiEndpoint?: string;
  isActive?: boolean;
  lastVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string;

  // Backward-compat for any legacy UI usage.
  username?: string;
  createdBy?: number;
  createdByUsername?: string;
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
  credentialId?: number;
  createdAt: string;
}

export interface PlayerMapping {
  id: number;
  internalPlayerId: number;
  internalPlayerName: string;
  twizzitPlayerId: string;
  twizzitPlayerName: string;
  credentialId?: number;
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
  organizationId?: string;
  usableForSync?: boolean;
  capabilities?: {
    organizations: boolean;
    groups: boolean;
    seasons: boolean;
  };
}

export interface TwizzitOption {
  id: string;
  name: string;
}

export interface TwizzitOrganizationAccess {
  id: string;
  name: string;
  canFetchGroups: boolean;
  canFetchSeasons: boolean;
  groupsError?: string | null;
  seasonsError?: string | null;
}

export interface TwizzitSyncOptions {
  organizations: TwizzitOption[];
  groups: TwizzitOption[];
  seasons: TwizzitOption[];
  defaultOrganizationId?: string;
  defaultOrganizationName?: string;
  warnings?: string[];
  organizationAccess?: TwizzitOrganizationAccess[];
}

export interface TwizzitTeamsPreview {
  total: number;
  teams: TwizzitOption[];
}

export interface TwizzitPlayersPreview {
  total: number;
  players: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}
