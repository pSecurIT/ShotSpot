import { vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchCommentary from '../components/MatchCommentary';
import api from '../utils/api';
import { waitForSelectOptions } from './helpers/testHelpers';

// Mock the api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('MatchCommentary', () => {
  const mockProps = {
    gameId: 1,
    currentPeriod: 1,
    timeRemaining: '00:08:30',
    onCommentaryAdded: vi.fn()
  };

  const mockComments = [
    {
      id: 1,
      game_id: 1,
      period: 1,
      time_remaining: '00:10:00',
      commentary_type: 'note',
      title: 'Great defensive play',
      content: 'Team Alpha showed excellent defense in this sequence',
      created_by_username: 'Coach Smith',
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z'
    },
    {
      id: 2,
      game_id: 1,
      period: 1,
      time_remaining: '00:08:45',
      commentary_type: 'highlight',
      title: null,
      content: 'Excellent shot attempt by player #10',
      created_by_username: 'Assistant Coach',
      created_at: '2024-01-15T10:31:00Z',
      updated_at: '2024-01-15T10:31:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/match-commentary')) {
        return Promise.resolve({ data: mockComments });
      }
      return Promise.resolve({ data: [] });
    });
    
    (api.post as jest.Mock).mockResolvedValue({
      data: { id: 3, game_id: 1, content: 'New commentary added', message: 'Commentary added successfully' }
    });
    
    (api.delete as jest.Mock).mockResolvedValue({
      data: { message: 'Commentary deleted successfully' }
    });
  });

  it('renders match commentary interface correctly', async () => {
    render(<MatchCommentary {...mockProps} />);
    
    expect(screen.getByText('Match Commentary')).toBeInTheDocument();
    expect(screen.getByText('📝 Add Note')).toBeInTheDocument();
    
    // Check filter elements
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('Period:')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Periods')).toBeInTheDocument();
  });

  it('loads and displays commentary history correctly', async () => {
    render(<MatchCommentary {...mockProps} />);
    
    // Wait for comments to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/match-commentary/1?');
    });
    
    // Check if comments are displayed
    await waitFor(() => {
      expect(screen.getByText('Team Alpha showed excellent defense in this sequence')).toBeInTheDocument();
      expect(screen.getByText('Excellent shot attempt by player #10')).toBeInTheDocument();
      expect(screen.getByText('by Coach Smith')).toBeInTheDocument();
      expect(screen.getByText('by Assistant Coach')).toBeInTheDocument();
    });
  });

  it('adds new commentary successfully', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Fill out form
    await user.click(screen.getByText('⭐ Highlight'));
    
    const titleInput = screen.getByPlaceholderText('Brief title or summary');
    await user.type(titleInput, 'Great Play');
    
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Outstanding teamwork in this sequence');
    
    // Submit comment
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    await user.click(addButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/match-commentary/1', expect.objectContaining({
        period: 1,
        time_remaining: '00:08:30',
        commentary_type: 'highlight',
        title: 'Great Play',
        content: 'Outstanding teamwork in this sequence'
      }));
    });
    
    // Verify callback was called
    expect(mockProps.onCommentaryAdded).toHaveBeenCalled();
  });

  it('adds different commentary types correctly', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Test injury commentary
    await user.click(screen.getByText('🏥 Injury'));
    
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Player #15 needs medical attention');
    
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    await user.click(addButton);
    
    // Verify API call with correct commentary type
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/match-commentary/1', expect.objectContaining({
        commentary_type: 'injury',
        content: 'Player #15 needs medical attention'
      }));
    });
  });

  it('validates required fields before submission', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Try to submit without filling content
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    
    // Button should be disabled when no content
    expect(addButton).toBeDisabled();
    
    // Verify API was not called
    expect(api.post).not.toHaveBeenCalled();
    expect(mockProps.onCommentaryAdded).not.toHaveBeenCalled();
  });

  it('disables add button when required fields are missing', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    expect(addButton).toBeDisabled();
  });

  it('enables add button when all required fields are filled', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Fill required content field
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Good game flow');
    
    // Button should now be enabled
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    expect(addButton).toBeEnabled();
  });

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock API error
    (api.post as jest.Mock).mockRejectedValue({
      response: { data: { error: 'Network error' } }
    });
    
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Fill out form
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Test commentary');
    
    // Submit and expect error handling
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    await user.click(addButton);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
    
    // Verify callback was not called on error
    expect(mockProps.onCommentaryAdded).not.toHaveBeenCalled();
  });

  it('clears form after successful submission', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Fill and submit form
    const titleInput = screen.getByPlaceholderText('Brief title or summary');
    await user.type(titleInput, 'Test title');
    
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Test commentary');
    
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    await user.click(addButton);
    
    // Wait for submission and verify form is hidden
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
    
    // Form should be hidden after submission
    expect(screen.queryByPlaceholderText('Enter your commentary or notes here...')).not.toBeInTheDocument();
  });

  it('displays comments in chronological order', async () => {
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Check that comments are displayed with timestamps
    await waitFor(() => {
      expect(screen.getByText(/Period 1 • 00:10:00/)).toBeInTheDocument();
      expect(screen.getByText(/Period 1 • 00:08:45/)).toBeInTheDocument();
    });
  });

  it('shows comment metadata correctly', async () => {
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Check comment metadata
    await waitFor(() => {
      expect(screen.getByText('General Note')).toBeInTheDocument();
      expect(screen.getByText('Key Moment')).toBeInTheDocument();
      expect(screen.getByText('by Coach Smith')).toBeInTheDocument();
      expect(screen.getByText('by Assistant Coach')).toBeInTheDocument();
    });
  });

  it('handles different commentary types in selection', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Test different commentary type buttons
    await user.click(screen.getByText('⭐ Highlight'));
    expect(screen.getByText('⭐ Highlight')).toHaveClass('active');
    
    await user.click(screen.getByText('🏥 Injury'));
    expect(screen.getByText('🏥 Injury')).toHaveClass('active');
    
    await user.click(screen.getByText('🌤️ Weather'));
    expect(screen.getByText('🌤️ Weather')).toHaveClass('active');
    
    await user.click(screen.getByText('⚙️ Technical'));
    expect(screen.getByText('⚙️ Technical')).toHaveClass('active');
    
    await user.click(screen.getByText('📝 Note'));
    expect(screen.getByText('📝 Note')).toHaveClass('active');
  });

  it('updates time remaining when prop changes', () => {
    const { rerender } = render(<MatchCommentary {...mockProps} />);
    
    // Update time remaining
    act(() => {
      rerender(<MatchCommentary {...mockProps} timeRemaining="00:05:00" />);
    });
    
    // Component should handle the updated time
    expect(screen.getByText('Match Commentary')).toBeInTheDocument();
  });

  it('handles missing onCommentaryAdded callback gracefully', async () => {
    const propsWithoutCallback = { ...mockProps, onCommentaryAdded: undefined };
    const user = userEvent.setup();
    
    render(<MatchCommentary {...propsWithoutCallback} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Fill and submit form
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Test commentary');
    
    const addButton = screen.getByRole('button', { name: 'Add Commentary' });
    await user.click(addButton);
    
    // Should not throw error even without callback
    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });
  });

  it('shows empty state when no comments exist', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
    
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Check for empty state message
    await waitFor(() => {
      expect(screen.getByText('No commentary added yet.')).toBeInTheDocument();
      expect(screen.getByText('Add First Note')).toBeInTheDocument();
    });
  });

  it('filters comments by type correctly', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Test filtering by type
    const typeFilter = screen.getByDisplayValue('All Types');
    await waitForSelectOptions(() => screen.getByDisplayValue('All Types'));
    await user.selectOptions(typeFilter, 'highlight');
    
    // Should trigger API call with filter
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/match-commentary/1?commentary_type=highlight');
    });
  });

  it('filters comments by period correctly', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Test filtering by period
    const periodFilter = screen.getByDisplayValue('All Periods');
    await waitForSelectOptions(() => screen.getByDisplayValue('All Periods'));
    await user.selectOptions(periodFilter, '2');
    
    // Should trigger API call with filter
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/match-commentary/1?period=2');
    });
  });

  it('handles character limit correctly', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    // Click to show form
    await user.click(screen.getByText('📝 Add Note'));
    
    // Test character count display
    const contentInput = screen.getByPlaceholderText('Enter your commentary or notes here...');
    await user.type(contentInput, 'Test content');
    
    expect(screen.getByText('12/2000 characters')).toBeInTheDocument();
  });

  it('deletes commentary successfully', async () => {
    const user = userEvent.setup();
    render(<MatchCommentary {...mockProps} />);
    
    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });
    
    // Click delete button
    const deleteButton = screen.getAllByText('🗑️')[0];
    await user.click(deleteButton);
    
    // Verify API call
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/match-commentary/1/1');
    });
  });
});