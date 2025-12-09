import React, { useState } from 'react';
import { ExportFormat, ExportOptions } from './ExportDialog';
import '../styles/ExportDialog.css';

interface ExportTemplate {
  id: number;
  name: string;
  description: string;
  format: ExportFormat;
  options: ExportOptions;
}

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: Omit<ExportTemplate, 'id'>) => void;
  template: ExportTemplate | null;
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  template
}) => {
  // Initialize state from template prop - component will re-mount when template changes due to key prop
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [format, setFormat] = useState<ExportFormat>(template?.format || 'pdf-summary');
  const [options, setOptions] = useState<ExportOptions>(template?.options || {
    includeCharts: true,
    includePlayerStats: false,
    includeTimeline: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      format,
      options
    });
  };

  if (!isOpen) return null;

  return (
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <h2>{template ? 'Edit Template' : 'Create Template'}</h2>
          <button className="export-dialog-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="export-dialog-content">
            <div className="form-group">
              <label htmlFor="template-name">Template Name *</label>
              <input
                id="template-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Match Summary Report"
                required
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-description">Description</label>
              <textarea
                id="template-description"
                className="form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this template"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-format">Export Format *</label>
              <select
                id="template-format"
                className="form-input"
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                required
              >
                <option value="pdf-summary">PDF - Summary</option>
                <option value="pdf-detailed">PDF - Detailed</option>
                <option value="csv">CSV - Raw Data</option>
                <option value="xlsx">Excel - Formatted</option>
                <option value="json">JSON - API Format</option>
              </select>
            </div>

            <div className="form-group">
              <label>Report Options</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.includeCharts}
                    onChange={(e) => setOptions({ ...options, includeCharts: e.target.checked })}
                  />
                  <span>Include Charts & Visualizations</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.includePlayerStats}
                    onChange={(e) => setOptions({ ...options, includePlayerStats: e.target.checked })}
                  />
                  <span>Include Player Statistics</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={options.includeTimeline}
                    onChange={(e) => setOptions({ ...options, includeTimeline: e.target.checked })}
                  />
                  <span>Include Event Timeline</span>
                </label>
              </div>
            </div>
          </div>

          <div className="export-dialog-footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">
              {template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateDialog;
