/**
 * Tests for OfflineIndicator Component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineIndicator from '../components/OfflineIndicator';
import * as useOfflineStatusModule from '../hooks/useOfflineStatus';

// Mock the useOfflineStatus hook
vi.mock('../hooks/useOfflineStatus');

describe('OfflineIndicator Component', () => {
  const mockSync = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockSync.mockClear();
  });

  describe('Visibility', () => {
    it('should not render when online with no pending actions', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 0,
        lastSyncTime: null,
        sync: mockSync
      });
      
      const { container } = render(<OfflineIndicator />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when offline', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: false,
        isSyncing: false,
        pendingActions: 0,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should render when there are pending actions', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('1 pending action')).toBeInTheDocument();
    });

    it('should render when syncing', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: true,
        pendingActions: 2,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should show offline status', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: false,
        isSyncing: false,
        pendingActions: 0,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('should show pending actions count (singular)', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('1 pending action')).toBeInTheDocument();
    });

    it('should show pending actions count (plural)', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 3,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('3 pending actions')).toBeInTheDocument();
    });

    it('should show syncing status', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: true,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });

  describe('Sync Now Button', () => {
    it('should show Sync Now button when there are pending actions', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 2,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
    });

    it('should not show Sync Now button when offline', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: false,
        isSyncing: false,
        pendingActions: 2,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });

    it('should not show Sync Now button when syncing', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: true,
        pendingActions: 2,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      expect(screen.queryByText('Sync Now')).not.toBeInTheDocument();
    });

    it('should trigger sync when Sync Now button is clicked', async () => {
      const user = userEvent.setup();
      
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      const syncButton = screen.getByText('Sync Now');
      
      await user.click(syncButton);
      
      expect(mockSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visual States', () => {
    it('should display red background when offline', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: false,
        isSyncing: false,
        pendingActions: 0,
        lastSyncTime: null,
        sync: mockSync
      });
      
      const { container } = render(<OfflineIndicator />);
      const statusDiv = container.querySelector('.bg-red-500');
      
      expect(statusDiv).toBeInTheDocument();
    });

    it('should display orange background when pending actions', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 2,
        lastSyncTime: null,
        sync: mockSync
      });
      
      const { container } = render(<OfflineIndicator />);
      const statusDiv = container.querySelector('.bg-orange-500');
      
      expect(statusDiv).toBeInTheDocument();
    });

    it('should display yellow background when syncing', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: true,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      const { container } = render(<OfflineIndicator />);
      const statusDiv = container.querySelector('.bg-yellow-500');
      
      expect(statusDiv).toBeInTheDocument();
    });

    it('should show loading spinner when syncing', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: true,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      const { container } = render(<OfflineIndicator />);
      const spinner = container.querySelector('.animate-spin');
      
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: false,
        isSyncing: false,
        pendingActions: 0,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      
      expect(screen.getByLabelText('Offline')).toBeInTheDocument();
    });

    it('should have accessible Sync Now button', () => {
      vi.spyOn(useOfflineStatusModule, 'useOfflineStatus').mockReturnValue({
        isOnline: true,
        isSyncing: false,
        pendingActions: 1,
        lastSyncTime: null,
        sync: mockSync
      });
      
      render(<OfflineIndicator />);
      
      expect(screen.getByLabelText('Sync pending actions')).toBeInTheDocument();
    });
  });
});
