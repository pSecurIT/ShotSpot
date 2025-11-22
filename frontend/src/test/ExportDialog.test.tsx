import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExportDialog from '../components/ExportDialog';

describe('ExportDialog', () => {
  it('should render when open', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    expect(screen.getByText('Test Export')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    const { container } = render(
      <ExportDialog
        isOpen={false}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should call onClose when close button clicked', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    const closeButton = screen.getByLabelText('Close dialog');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should allow format selection', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    const csvRadio = screen.getByLabelText(/CSV/);
    fireEvent.click(csvRadio);

    expect(csvRadio).toBeChecked();
  });

  it('should call onExport with selected format when export button clicked', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledTimes(1);
    expect(mockOnExport).toHaveBeenCalledWith(
      'pdf-summary',
      expect.objectContaining({
        includeCharts: true,
        includeTimeline: true,
        includePlayerStats: true,
        includeTeamStats: true
      })
    );
  });

  it('should show email input when email share method selected', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    const emailRadio = screen.getByLabelText('Email');
    fireEvent.click(emailRadio);

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('should show preview when preview button clicked', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    const previewButton = screen.getByText('Preview');
    fireEvent.click(previewButton);

    expect(screen.getByText('Export Preview')).toBeInTheDocument();
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('should render appropriate options for different data types', () => {
    const mockOnClose = vi.fn();
    const mockOnExport = vi.fn();

    const { rerender } = render(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="game"
      />
    );

    expect(screen.getByText('Include Timeline')).toBeInTheDocument();

    rerender(
      <ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        title="Test Export"
        dataType="player"
      />
    );

    expect(screen.queryByText('Include Timeline')).not.toBeInTheDocument();
    expect(screen.getByText('Include Performance Charts')).toBeInTheDocument();
  });
});
