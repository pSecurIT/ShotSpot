import React from 'react';
import type { ReportTemplateSection, TemplateSectionType } from '../types/report-templates';
import { METRIC_OPTIONS } from '../types/report-templates';

interface TemplateSectionEditorProps {
  section: ReportTemplateSection;
  disabled?: boolean;
  onChange: (section: ReportTemplateSection) => void;
}

const metricFriendlyName = (metricId: string) => {
  return METRIC_OPTIONS.find((metric) => metric.value === metricId)?.label || metricId;
};

const TemplateSectionEditor: React.FC<TemplateSectionEditorProps> = ({ section, disabled = false, onChange }) => {
  const updateSection = (updates: Partial<ReportTemplateSection>) => {
    onChange({
      ...section,
      ...updates,
    });
  };

  const updateConfig = (updates: Partial<ReportTemplateSection['config']>) => {
    onChange({
      ...section,
      config: {
        ...section.config,
        ...updates,
      },
    });
  };

  const toggleMetric = (metricId: string) => {
    const nextMetrics = section.config.metricIds.includes(metricId as never)
      ? section.config.metricIds.filter((metric) => metric !== metricId)
      : [...section.config.metricIds, metricId as never];

    updateConfig({ metricIds: nextMetrics });
  };

  const renderMetricSelector = (legend: string) => (
    <fieldset className="report-templates__fieldset">
      <legend>{legend}</legend>
      <div className="report-templates__checkbox-grid">
        {METRIC_OPTIONS.map((metric) => (
          <label key={metric.value} className="report-templates__checkbox-item">
            <input
              type="checkbox"
              checked={section.config.metricIds.includes(metric.value)}
              onChange={() => toggleMetric(metric.value)}
              disabled={disabled}
            />
            <span>{metric.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const renderConfigFields = (type: TemplateSectionType) => {
    if (type === 'summary') {
      return (
        <>
          <label className="report-templates__field">
            <span>Highlight Metric</span>
            <select
              value={section.config.highlightMetric}
              onChange={(event) => updateConfig({ highlightMetric: event.target.value as typeof section.config.highlightMetric })}
              disabled={disabled}
            >
              {METRIC_OPTIONS.map((metric) => (
                <option key={metric.value} value={metric.value}>{metric.label}</option>
              ))}
            </select>
          </label>

          <label className="report-templates__field">
            <span>Summary Emphasis</span>
            <select
              value={section.config.emphasis}
              onChange={(event) => updateConfig({ emphasis: event.target.value as typeof section.config.emphasis })}
              disabled={disabled}
            >
              <option value="score">Score</option>
              <option value="trend">Trend</option>
              <option value="momentum">Momentum</option>
            </select>
          </label>

          <label className="report-templates__checkbox-item report-templates__checkbox-item--single">
            <input
              type="checkbox"
              checked={section.config.showCallout}
              onChange={(event) => updateConfig({ showCallout: event.target.checked })}
              disabled={disabled}
            />
            <span>Show callout banner</span>
          </label>
        </>
      );
    }

    if (type === 'stats') {
      return (
        <>
          {renderMetricSelector('Stats to include')}

          <label className="report-templates__field">
            <span>Columns</span>
            <select
              value={section.config.columns}
              onChange={(event) => updateConfig({ columns: Number(event.target.value) as typeof section.config.columns })}
              disabled={disabled}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>

          <label className="report-templates__checkbox-item report-templates__checkbox-item--single">
            <input
              type="checkbox"
              checked={section.config.showComparison}
              onChange={(event) => updateConfig({ showComparison: event.target.checked })}
              disabled={disabled}
            />
            <span>Show comparison delta</span>
          </label>
        </>
      );
    }

    if (type === 'charts') {
      return (
        <>
          {renderMetricSelector('Metrics to chart')}

          <label className="report-templates__field">
            <span>Chart Type</span>
            <select
              value={section.config.chartType}
              onChange={(event) => updateConfig({ chartType: event.target.value as typeof section.config.chartType })}
              disabled={disabled}
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
              <option value="heatmap">Heatmap</option>
            </select>
          </label>

          <label className="report-templates__field">
            <span>Timeframe</span>
            <select
              value={section.config.timeframe}
              onChange={(event) => updateConfig({ timeframe: event.target.value as typeof section.config.timeframe })}
              disabled={disabled}
            >
              <option value="full_match">Full Match</option>
              <option value="per_period">Per Period</option>
              <option value="last_5_minutes">Last 5 Minutes</option>
            </select>
          </label>
        </>
      );
    }

    if (type === 'commentary') {
      return (
        <>
          <label className="report-templates__field">
            <span>Tone</span>
            <select
              value={section.config.tone}
              onChange={(event) => updateConfig({ tone: event.target.value as typeof section.config.tone })}
              disabled={disabled}
            >
              <option value="neutral">Neutral</option>
              <option value="coach">Coach</option>
              <option value="broadcast">Broadcast</option>
            </select>
          </label>

          <label className="report-templates__field">
            <span>Max Commentary Items</span>
            <input
              type="number"
              min={1}
              max={12}
              value={section.config.maxItems}
              onChange={(event) => updateConfig({ maxItems: Number(event.target.value) || 1 })}
              disabled={disabled}
            />
          </label>

          <label className="report-templates__checkbox-item report-templates__checkbox-item--single">
            <input
              type="checkbox"
              checked={section.config.includeTimestamps}
              onChange={(event) => updateConfig({ includeTimestamps: event.target.checked })}
              disabled={disabled}
            />
            <span>Include timestamps</span>
          </label>
        </>
      );
    }

    return (
      <>
        {renderMetricSelector('Metrics to compare')}

        <label className="report-templates__field">
          <span>Compare By</span>
          <select
            value={section.config.compareBy}
            onChange={(event) => updateConfig({ compareBy: event.target.value as typeof section.config.compareBy })}
            disabled={disabled}
          >
            <option value="team">Team</option>
            <option value="period">Period</option>
            <option value="player_group">Player Group</option>
          </select>
        </label>

        <label className="report-templates__field">
          <span>Layout</span>
          <select
            value={section.config.layout}
            onChange={(event) => updateConfig({ layout: event.target.value as typeof section.config.layout })}
            disabled={disabled}
          >
            <option value="table">Table</option>
            <option value="cards">Cards</option>
          </select>
        </label>
      </>
    );
  };

  return (
    <section className="report-templates__editor" aria-label="Section Configuration">
      <header className="report-templates__editor-header">
        <div>
          <h3>Section Configuration</h3>
          <p>{section.type.charAt(0).toUpperCase() + section.type.slice(1)} section</p>
        </div>
        <span className="report-templates__editor-chip">{metricFriendlyName(section.config.highlightMetric)}</span>
      </header>

      <label className="report-templates__field">
        <span>Section Title</span>
        <input
          value={section.title}
          onChange={(event) => updateSection({ title: event.target.value })}
          disabled={disabled}
          maxLength={100}
        />
      </label>

      <label className="report-templates__field">
        <span>Section Description</span>
        <textarea
          value={section.description}
          onChange={(event) => updateSection({ description: event.target.value })}
          disabled={disabled}
          rows={3}
          maxLength={280}
        />
      </label>

      {renderConfigFields(section.type)}
    </section>
  );
};

export default TemplateSectionEditor;