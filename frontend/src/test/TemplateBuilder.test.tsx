import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TemplateBuilder from '../components/TemplateBuilder';
import type { ReportTemplateDraft } from '../types/report-templates';

const seededDraft: ReportTemplateDraft = {
  id: 9,
  name: 'Weekly Summary',
  type: 'custom',
  description: 'Existing template',
  sections: [
    {
      id: 'section-1',
      type: 'summary',
      title: 'Executive Summary',
      description: 'Opening notes',
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
    {
      id: 'section-2',
      type: 'stats',
      title: 'Stats Grid',
      description: 'KPI summary',
      config: {
        metricIds: ['goals', 'assists'],
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
  metrics: ['goals', 'assists'],
  is_default: false,
  is_active: true,
};

describe('TemplateBuilder', () => {
  it('adds a section and edits its configuration', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<TemplateBuilder initialDraft={seededDraft} mode="edit" onSave={onSave} />);

    await user.selectOptions(screen.getByLabelText('Add Section Type'), 'commentary');
    await user.click(screen.getByRole('button', { name: 'Add Section' }));

    expect(screen.getAllByText('Coach Commentary').length).toBeGreaterThan(0);

    await user.clear(screen.getByLabelText('Section Title'));
    await user.type(screen.getByLabelText('Section Title'), 'Bench Notes');
    await user.selectOptions(screen.getByLabelText('Tone'), 'broadcast');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            title: 'Bench Notes',
            config: expect.objectContaining({ tone: 'broadcast' }),
          }),
        ]),
      }));
    });
  });

  it('reorders sections with drag and drop', async () => {
    render(<TemplateBuilder initialDraft={seededDraft} mode="edit" onSave={vi.fn().mockResolvedValue(undefined)} />);

    const sectionButtons = screen.getAllByRole('button', { name: /Executive Summary|Stats Grid/ });
    const summaryCard = sectionButtons[0].closest('article');
    const statsCard = sectionButtons[1].closest('article');

    expect(summaryCard).not.toBeNull();
    expect(statsCard).not.toBeNull();

    fireEvent.dragStart(summaryCard as HTMLElement);
    fireEvent.dragOver(statsCard as HTMLElement);
    fireEvent.drop(statsCard as HTMLElement);

    const reorderedButtons = screen.getAllByRole('button', { name: /Executive Summary|Stats Grid/ });
    expect(reorderedButtons[0]).toHaveTextContent('Stats Grid');
    expect(reorderedButtons[1]).toHaveTextContent('Executive Summary');
  });

  it('shows read-only mode for default templates', () => {
    render(
      <TemplateBuilder
        initialDraft={{ ...seededDraft, is_default: true }}
        mode="edit"
        readOnly
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDuplicate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Duplicate Template' })).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name')).toBeDisabled();
  });
});