import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import api from '../utils/api';
import MatchTemplates from '../components/MatchTemplates';
import { AuthProvider } from '../contexts/AuthContext';

const mock = new MockAdapter(api);

const mockTemplates = [
  {
    id: 1,
    name: 'Standard League Match',
    description: 'Standard korfball league match with 4 periods of 10 minutes each',
    number_of_periods: 4,
    period_duration_minutes: 10,
    overtime_enabled: false,
    overtime_period_duration_minutes: 5,
    max_overtime_periods: 2,
    golden_goal_overtime: false,
    competition_type: 'league',
    is_system_template: true,
    created_by: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    name: 'Cup Match with Overtime',
    description: 'Cup match with overtime allowed',
    number_of_periods: 4,
    period_duration_minutes: 10,
    overtime_enabled: true,
    overtime_period_duration_minutes: 5,
    max_overtime_periods: 2,
    golden_goal_overtime: false,
    competition_type: 'cup',
    is_system_template: true,
    created_by: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 3,
    name: 'My Custom Template',
    description: 'A custom template',
    number_of_periods: 2,
    period_duration_minutes: 15,
    overtime_enabled: true,
    overtime_period_duration_minutes: 5,
    max_overtime_periods: 2,
    golden_goal_overtime: true,
    competition_type: 'friendly',
    is_system_template: false,
    created_by: 1,
    created_by_username: 'coach',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }
];

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <AuthProvider>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </AuthProvider>
  );
};

describe('MatchTemplates', () => {
  beforeEach(() => {
    mock.reset();
    mock.onGet('/match-templates').reply(200, mockTemplates);
    mock.onGet('/auth/me').reply(200, { id: 1, username: 'coach', role: 'coach' });
    localStorage.setItem('token', 'test-token');
  });

  it('should render loading state initially', () => {
    renderWithProviders(<MatchTemplates />);
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('should render templates after loading', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('Standard League Match')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Cup Match with Overtime')).toBeInTheDocument();
    expect(screen.getByText('My Custom Template')).toBeInTheDocument();
  });

  it('should display system templates section', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('📌 System Templates')).toBeInTheDocument();
    });
  });

  it('should display user templates section when user has custom templates', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('👤 My Templates')).toBeInTheDocument();
    });
  });

  it('should show overtime badge for templates with overtime enabled', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('Cup Match with Overtime')).toBeInTheDocument();
    });
    
    // Check for overtime details
    const overtimeElements = screen.getAllByText(/Overtime:/i);
    expect(overtimeElements.length).toBeGreaterThan(0);
  });

  it('should show golden goal indicator for templates with golden goal', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('⚽ Golden Goal')).toBeInTheDocument();
    });
  });

  it('should show create template form when clicking new template button', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('+ New Template')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('+ New Template'));
    
    expect(screen.getByText('Create New Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name *')).toBeInTheDocument();
  });

  it('should show overtime settings when overtime is enabled in form', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('+ New Template')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('+ New Template'));
    
    // Enable overtime
    const overtimeCheckbox = screen.getByLabelText('Enable Overtime');
    fireEvent.click(overtimeCheckbox);
    
    // Check for golden goal option in form (use getAllBy since there can be multiple)
    const goldenGoalElements = screen.getAllByText(/Golden Goal/);
    expect(goldenGoalElements.length).toBeGreaterThan(0);
  });

  it('should call onSelectTemplate when in selection mode', async () => {
    const onSelectTemplate = vi.fn();
    
    renderWithProviders(
      <MatchTemplates onSelectTemplate={onSelectTemplate} selectionMode={true} />
    );
    
    await waitFor(() => {
      expect(screen.getByText('Standard League Match')).toBeInTheDocument();
    });
    
    // Click use template button
    const useButtons = screen.getAllByText('Use Template');
    fireEvent.click(useButtons[0]);
    
    expect(onSelectTemplate).toHaveBeenCalled();
  });

  it('should show Edit and Delete buttons for user templates', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('My Custom Template')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should show System Template badge for system templates', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('Standard League Match')).toBeInTheDocument();
    });
    
    expect(screen.getAllByText('System Template').length).toBeGreaterThan(0);
  });

  it('should display competition type badges', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('League')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Cup')).toBeInTheDocument();
    expect(screen.getByText('Friendly')).toBeInTheDocument();
  });

  it('should populate form when editing a template', async () => {
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('My Custom Template')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Edit'));
    
    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My Custom Template')).toBeInTheDocument();
  });

  it('should create a new template successfully', async () => {
    mock.onPost('/match-templates').reply(201, {
      id: 4,
      name: 'New Test Template',
      number_of_periods: 4,
      period_duration_minutes: 10,
      overtime_enabled: false,
      is_system_template: false
    });

    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('+ New Template')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('+ New Template'));
    
    fireEvent.change(screen.getByLabelText('Template Name *'), {
      target: { value: 'New Test Template' }
    });
    
    fireEvent.click(screen.getByText('Create Template'));
    
    await waitFor(() => {
      expect(screen.getByText('Template created successfully')).toBeInTheDocument();
    });
  });

  it('should handle delete confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('My Custom Template')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Delete'));
    
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('should show error when fetching templates fails', async () => {
    mock.onGet('/match-templates').reply(500);
    
    renderWithProviders(<MatchTemplates />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load match templates')).toBeInTheDocument();
    });
  });
});
