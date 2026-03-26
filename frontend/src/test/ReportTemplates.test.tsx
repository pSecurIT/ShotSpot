import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportTemplates from '../components/ReportTemplates';
import { reportTemplatesApi } from '../services/reportTemplatesApi';
import type { ReportTemplate } from '../types/report-templates';

vi.mock('../services/reportTemplatesApi', () => ({
  reportTemplatesApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const seededTemplate: ReportTemplate = {
  id: 3,
  name: 'Game Summary',
  type: 'summary',
  description: 'Default summary report',
  sections: [
    {
      id: 'section-1',
      type: 'summary',
      title: 'Executive Summary',
      description: 'Summary section',
      config: {
        metricIds: ['goals'],
        columns: 2,
        showComparison: true,
        chartType: 'bar',
        timeframe: 'full_match',
        tone: 'neutral',
        maxItems: 3,
        includeTimestamps: true,
        layout: 'table',
        compareBy: 'team',
        highlightMetric: 'goals',
        emphasis: 'score',
        showCallout: true,
      },
    },
  ],
  metrics: ['goals'],
  is_default: true,
  is_active: true,
  created_by: null,
  created_by_username: 'system',
  branding: {},
  language: 'en',
  date_format: 'YYYY-MM-DD',
  time_format: '24h',
  created_at: '2026-03-20T10:00:00.000Z',
  updated_at: '2026-03-20T10:00:00.000Z',
};

describe('ReportTemplates', () => {
  const getAllMock = reportTemplatesApi.getAll as ReturnType<typeof vi.fn>;
  const createMock = reportTemplatesApi.create as ReturnType<typeof vi.fn>;
  const updateMock = reportTemplatesApi.update as ReturnType<typeof vi.fn>;
  const removeMock = reportTemplatesApi.remove as ReturnType<typeof vi.fn>;
  const createObjectUrl = vi.fn(() => 'blob:template');
  const revokeObjectUrl = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('URL', {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    getAllMock.mockResolvedValue([seededTemplate]);
    createMock.mockImplementation(async (payload) => ({
      ...seededTemplate,
      ...payload,
      id: 21,
      is_default: false,
      updated_at: '2026-03-26T12:00:00.000Z',
    }));
    updateMock.mockImplementation(async (_id, payload) => ({
      ...seededTemplate,
      ...payload,
      id: 3,
      is_default: false,
    }));
    removeMock.mockResolvedValue({ message: 'ok' });
  });

  it('renders existing templates and opens default template in read-only mode', async () => {
    render(<ReportTemplates />);

    expect((await screen.findAllByText('Game Summary')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Duplicate Template' })).toBeInTheDocument();
  });

  it('creates a new template', async () => {
    const user = userEvent.setup();
    render(<ReportTemplates />);

    expect((await screen.findAllByText('Game Summary')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '+ New Template' }));
    await user.type(screen.getByLabelText('Template Name'), 'Weekly Insights');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Weekly Insights' }));
    });
  });

  it('duplicates and exports a template', async () => {
    const user = userEvent.setup();
    render(<ReportTemplates />);

    expect((await screen.findAllByText('Game Summary')).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: 'Duplicate' })[0]);

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Game Summary Copy' }));
    });

    await user.click(screen.getAllByRole('button', { name: 'Export JSON' })[0]);

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
  });

  it('deletes a custom template', async () => {
    const user = userEvent.setup();
    getAllMock.mockResolvedValueOnce([{ ...seededTemplate, id: 8, is_default: false, name: 'Custom Template' }]);

    render(<ReportTemplates />);

  expect((await screen.findAllByText('Custom Template')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(removeMock).toHaveBeenCalledWith(8);
    });
  });
});