import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TwizzitSettings from '../components/TwizzitSettings';
import api from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}));

describe('TwizzitSettings', () => {
  const mockAdminUser = { id: 1, email: 'admin@test.com', role: 'admin' };
  const mockCoachUser = { id: 2, email: 'coach@test.com', role: 'coach' };

  const mockConfig = {
    id: 1,
    organization_id: 123,
    organization_name: 'Test Organization',
    username: 'testuser',
    sync_enabled: true,
    auto_sync_frequency: 'daily',
    sync_in_progress: false,
    last_sync_at: '2024-12-01T10:00:00Z'
  };

  const renderWithAuth = (user = mockAdminUser) => {
    return render(
      <AuthContext.Provider value={{ user, login: vi.fn(), logout: vi.fn() }}>
        <TwizzitSettings />
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show admin-only message for non-admin users', () => {
    renderWithAuth(mockCoachUser);
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
  });

  it('should render settings form for admin users', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [] } });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByText(/twizzit integration settings/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    });
  });

  it('should load and display existing configuration', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [mockConfig] } });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Organization')).toBeInTheDocument();
      // Username and password are not populated from config for security reasons
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  it('should test connection successfully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [] } });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true, message: 'Connection successful' } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
    });

    // Fill in required fields
    await user.type(screen.getByLabelText(/organization id/i), '123');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'testpass');

    // Click test connection button
    const testButton = screen.getByText(/test connection/i);
    await user.click(testButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/twizzit/test-connection', {
        username: 'testuser',
        password: 'testpass'
      });
      expect(screen.getByText(/connection successful/i)).toBeInTheDocument();
    });
  });

  it('should handle test connection failure', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [] } });
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({ 
      response: { data: { error: 'Invalid credentials' } } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/organization id/i), '123');
    await user.type(screen.getByLabelText(/username/i), 'baduser');
    await user.type(screen.getByLabelText(/password/i), 'badpass');

    const testButton = screen.getByText(/test connection/i);
    await user.click(testButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('should save configuration successfully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [] } });
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ 
      data: { success: true, config: mockConfig } 
    });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
    });

    // Fill in form
    await user.type(screen.getByLabelText(/organization id/i), '123');
    await user.type(screen.getByLabelText(/organization name/i), 'Test Organization');
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'testpass');

    // Save configuration
    const saveButton = screen.getByText(/save configuration/i);
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/twizzit/configure', expect.objectContaining({
        organizationId: 123,
        organizationName: 'Test Organization',
        username: 'testuser',
        password: 'testpass'
      }));
      expect(screen.getByText(/configuration saved successfully/i)).toBeInTheDocument();
    });
  });

  it('should validate required fields before saving', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [] } });
    
    renderWithAuth(mockAdminUser);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/organization id/i)).toBeInTheDocument();
    });

    // Save button should be disabled when required fields are empty
    const saveButton = screen.getByText(/save configuration/i);
    expect(saveButton).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('should delete configuration with confirmation', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [mockConfig] } });
    (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByText(/delete configuration/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByText(/delete configuration/i);
    await user.click(deleteButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(api.delete).toHaveBeenCalledWith('/twizzit/config/123');
      expect(screen.getByText(/configuration deleted successfully/i)).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('should toggle sync enabled checkbox', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [mockConfig] } });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/enable automatic sync/i)).toBeInTheDocument();
    });

    const checkbox = screen.getByLabelText(/enable automatic sync/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('should change auto sync frequency', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { configs: [mockConfig] } });
    
    renderWithAuth(mockAdminUser);
    const user = userEvent.setup();
    
    await waitFor(() => {
      expect(screen.getByLabelText(/sync frequency/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/sync frequency/i);
    await user.selectOptions(select, 'hourly');
    
    expect((select as HTMLSelectElement).value).toBe('hourly');
  });
});
