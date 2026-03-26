import React from 'react';
import type { ReportTemplateDraft, ReportTemplateSection } from '../types/report-templates';
import { getMetricLabel } from '../types/report-templates';

interface TemplatePreviewProps {
  draft: ReportTemplateDraft;
}

const renderSectionPreview = (section: ReportTemplateSection) => {
  if (section.type === 'summary') {
    return (
      <div className="report-templates__preview-callout">
        <strong>{getMetricLabel(section.config.highlightMetric)}</strong>
        <span>{section.config.emphasis === 'score' ? 'Headline score moment' : `Focus on ${section.config.emphasis}`}</span>
      </div>
    );
  }

  if (section.type === 'stats') {
    return (
      <div className={`report-templates__preview-metrics report-templates__preview-metrics--cols-${section.config.columns}`}>
        {section.config.metricIds.map((metricId) => (
          <span key={metricId} className="report-templates__preview-metric">{getMetricLabel(metricId)}</span>
        ))}
      </div>
    );
  }

  if (section.type === 'charts') {
    return (
      <div className="report-templates__preview-chart">
        <span>{section.config.chartType.toUpperCase()} chart</span>
        <span>{section.config.timeframe.replace(/_/g, ' ')}</span>
      </div>
    );
  }

  if (section.type === 'commentary') {
    return (
      <ul className="report-templates__preview-notes">
        {Array.from({ length: Math.min(section.config.maxItems, 4) }).map((_, index) => (
          <li key={`${section.id}-${index}`}>
            {section.config.includeTimestamps ? `${index + 1}0:00` : 'Note'} - {section.config.tone} commentary item
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`report-templates__preview-comparison report-templates__preview-comparison--${section.config.layout}`}>
      {section.config.metricIds.map((metricId) => (
        <div key={metricId} className="report-templates__preview-comparison-item">
          <span>{getMetricLabel(metricId)}</span>
          <strong>{section.config.compareBy.replace(/_/g, ' ')}</strong>
        </div>
      ))}
    </div>
  );
};

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ draft }) => {
  return (
    <section className="report-templates__preview" aria-label="Template Preview">
      <header className="report-templates__preview-header">
        <div>
          <h3>Preview</h3>
          <p>{draft.name.trim() || 'Untitled Template'}</p>
        </div>
        <span className="report-templates__preview-badge">{draft.type.replace(/_/g, ' ')}</span>
      </header>

      <div className="report-templates__preview-stack">
        {draft.sections.map((section) => (
          <article key={section.id} className="report-templates__preview-card">
            <header>
              <h4>{section.title}</h4>
              <span>{section.type}</span>
            </header>
            {section.description && <p>{section.description}</p>}
            {renderSectionPreview(section)}
          </article>
        ))}
      </div>
    </section>
  );
};

export default TemplatePreview;