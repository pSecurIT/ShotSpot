import React, { useState } from 'react';
import '../styles/ExportDialog.css';

export type ExportFormat = 'pdf-summary' | 'pdf-detailed' | 'csv';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, options: ExportOptions) => void;
  title?: string;
  dataType: 'game' | 'player' | 'team' | 'comparison';
}

export interface ExportOptions {
  includeCharts?: boolean;
  includeTimeline?: boolean;
  includePlayerStats?: boolean;
  includeTeamStats?: boolean;
  dateRange?: { start: string; end: string };
  emailTo?: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  title = 'Export Data',
  dataType
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf-summary');
  const [showPreview, setShowPreview] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeCharts: true,
    includeTimeline: true,
    includePlayerStats: true,
    includeTeamStats: true
  });
  const [emailAddress, setEmailAddress] = useState('');
  const [shareMethod, setShareMethod] = useState<'download' | 'email' | 'link'>('download');

  if (!isOpen) return null;

  const handleExport = () => {
    const options = {
      ...exportOptions,
      ...(shareMethod === 'email' && emailAddress ? { emailTo: emailAddress } : {})
    };
    onExport(selectedFormat, options);
    onClose();
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const getFormatDescription = (format: ExportFormat): string => {
    switch (format) {
      case 'pdf-summary':
        return 'Compact PDF with key statistics and highlights';
      case 'pdf-detailed':
        return 'Comprehensive PDF with all statistics, charts, and timeline';
      case 'csv':
        return 'Raw data in CSV format for further analysis';
      default:
        return '';
    }
  };

  const renderOptionsForDataType = () => {
    switch (dataType) {
      case 'game':
        return (
          <>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeCharts}
                onChange={(e) => setExportOptions({ ...exportOptions, includeCharts: e.target.checked })}
              />
              <span>Include Charts</span>
            </label>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeTimeline}
                onChange={(e) => setExportOptions({ ...exportOptions, includeTimeline: e.target.checked })}
              />
              <span>Include Timeline</span>
            </label>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includePlayerStats}
                onChange={(e) => setExportOptions({ ...exportOptions, includePlayerStats: e.target.checked })}
              />
              <span>Include Player Statistics</span>
            </label>
          </>
        );
      case 'player':
      case 'comparison':
        return (
          <>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeCharts}
                onChange={(e) => setExportOptions({ ...exportOptions, includeCharts: e.target.checked })}
              />
              <span>Include Performance Charts</span>
            </label>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includePlayerStats}
                onChange={(e) => setExportOptions({ ...exportOptions, includePlayerStats: e.target.checked })}
              />
              <span>Include Detailed Statistics</span>
            </label>
          </>
        );
      case 'team':
        return (
          <>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeCharts}
                onChange={(e) => setExportOptions({ ...exportOptions, includeCharts: e.target.checked })}
              />
              <span>Include Team Charts</span>
            </label>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includeTeamStats}
                onChange={(e) => setExportOptions({ ...exportOptions, includeTeamStats: e.target.checked })}
              />
              <span>Include Team Statistics</span>
            </label>
            <label className="export-option">
              <input
                type="checkbox"
                checked={exportOptions.includePlayerStats}
                onChange={(e) => setExportOptions({ ...exportOptions, includePlayerStats: e.target.checked })}
              />
              <span>Include Player Breakdown</span>
            </label>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <div className="export-dialog-content">
          {!showPreview ? (
            <>
              <div className="export-section">
                <h3>Select Format</h3>
                <div className="format-options">
                  <label className={`format-option ${selectedFormat === 'pdf-summary' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value="pdf-summary"
                      checked={selectedFormat === 'pdf-summary'}
                      onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                    />
                    <div className="format-details">
                      <span className="format-name">PDF Summary</span>
                      <span className="format-description">{getFormatDescription('pdf-summary')}</span>
                    </div>
                  </label>
                  <label className={`format-option ${selectedFormat === 'pdf-detailed' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value="pdf-detailed"
                      checked={selectedFormat === 'pdf-detailed'}
                      onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                    />
                    <div className="format-details">
                      <span className="format-name">PDF Detailed</span>
                      <span className="format-description">{getFormatDescription('pdf-detailed')}</span>
                    </div>
                  </label>
                  <label className={`format-option ${selectedFormat === 'csv' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={selectedFormat === 'csv'}
                      onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                    />
                    <div className="format-details">
                      <span className="format-name">CSV</span>
                      <span className="format-description">{getFormatDescription('csv')}</span>
                    </div>
                  </label>
                </div>
              </div>

              {selectedFormat !== 'csv' && (
                <div className="export-section">
                  <h3>Export Options</h3>
                  <div className="export-options">
                    {renderOptionsForDataType()}
                  </div>
                </div>
              )}

              <div className="export-section">
                <h3>Share Method</h3>
                <div className="share-options">
                  <label className="share-option">
                    <input
                      type="radio"
                      name="shareMethod"
                      value="download"
                      checked={shareMethod === 'download'}
                      onChange={(e) => setShareMethod(e.target.value as 'download' | 'email' | 'link')}
                    />
                    <span>Download</span>
                  </label>
                  <label className="share-option">
                    <input
                      type="radio"
                      name="shareMethod"
                      value="email"
                      checked={shareMethod === 'email'}
                      onChange={(e) => setShareMethod(e.target.value as 'download' | 'email' | 'link')}
                    />
                    <span>Email</span>
                  </label>
                  <label className="share-option">
                    <input
                      type="radio"
                      name="shareMethod"
                      value="link"
                      checked={shareMethod === 'link'}
                      onChange={(e) => setShareMethod(e.target.value as 'download' | 'email' | 'link')}
                    />
                    <span>Generate Link</span>
                  </label>
                </div>

                {shareMethod === 'email' && (
                  <div className="email-input-group">
                    <label htmlFor="email-address">Email Address</label>
                    <input
                      id="email-address"
                      type="email"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      placeholder="recipient@example.com"
                      required
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="export-preview">
              <h3>Export Preview</h3>
              <p>Preview functionality will be available in the next update.</p>
              <p>Your export will include:</p>
              <ul>
                <li>Format: {selectedFormat.toUpperCase()}</li>
                {exportOptions.includeCharts && <li>Charts and Visualizations</li>}
                {exportOptions.includeTimeline && <li>Event Timeline</li>}
                {exportOptions.includePlayerStats && <li>Player Statistics</li>}
                {exportOptions.includeTeamStats && <li>Team Statistics</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="export-dialog-footer">
          {!showPreview ? (
            <>
              <button className="secondary-button" onClick={handlePreview}>
                Preview
              </button>
              <button className="primary-button" onClick={handleExport}>
                {shareMethod === 'download' ? 'Export' : shareMethod === 'email' ? 'Send Email' : 'Generate Link'}
              </button>
            </>
          ) : (
            <>
              <button className="secondary-button" onClick={() => setShowPreview(false)}>
                Back
              </button>
              <button className="primary-button" onClick={handleExport}>
                Confirm Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
