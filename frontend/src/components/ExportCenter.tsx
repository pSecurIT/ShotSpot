import React, { useState, useEffect } from 'react';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';
import api from '../utils/api';
import '../styles/ExportCenter.css';

interface ExportRecord {
  id: number;
  name: string;
  format: ExportFormat;
  dataType: 'game' | 'player' | 'team' | 'comparison';
  createdAt: string;
  size: string;
  status: 'completed' | 'processing' | 'failed';
  downloadUrl?: string;
}

interface ExportTemplate {
  id: number;
  name: string;
  description: string;
  format: ExportFormat;
  options: ExportOptions;
}

const ExportCenter: React.FC = () => {
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([]);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedExportType, setSelectedExportType] = useState<'game' | 'player' | 'team' | 'comparison'>('game');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'exports' | 'templates' | 'schedule'>('exports');

  useEffect(() => {
    fetchRecentExports();
    fetchTemplates();
  }, []);

  const fetchRecentExports = async () => {
    try {
      setLoading(true);
      // This would be an actual API call in production
      // const response = await api.get('/exports/recent');
      // setRecentExports(response.data);
      
      // Mock data for now
      setRecentExports([
        {
          id: 1,
          name: 'Game Report - Team A vs Team B',
          format: 'pdf-detailed',
          dataType: 'game',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          size: '2.3 MB',
          status: 'completed',
          downloadUrl: '/exports/1'
        },
        {
          id: 2,
          name: 'Player Stats - Season Summary',
          format: 'csv',
          dataType: 'player',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          size: '156 KB',
          status: 'completed',
          downloadUrl: '/exports/2'
        }
      ]);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to fetch exports');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      // Mock data for now
      setTemplates([
        {
          id: 1,
          name: 'Match Summary',
          description: 'Quick overview with key statistics',
          format: 'pdf-summary',
          options: { includeCharts: true, includePlayerStats: true }
        },
        {
          id: 2,
          name: 'Full Game Report',
          description: 'Comprehensive analysis with all details',
          format: 'pdf-detailed',
          options: { includeCharts: true, includeTimeline: true, includePlayerStats: true }
        }
      ]);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleExport = async (format: ExportFormat, options: ExportOptions) => {
    try {
      setSuccess('');
      setError('');
      
      // This would be an actual API call in production
      // await api.post('/exports', { format, options, dataType: selectedExportType });
      
      setSuccess('Export started successfully! Check recent exports for progress.');
      setTimeout(() => {
        fetchRecentExports();
      }, 1000);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Export failed');
    }
  };

  const handleDownload = async (exportRecord: ExportRecord) => {
    try {
      setSuccess('');
      setError('');
      
      // This would be an actual download in production
      // const response = await api.get(exportRecord.downloadUrl, { responseType: 'blob' });
      // const url = window.URL.createObjectURL(new Blob([response.data]));
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = exportRecord.name;
      // link.click();
      
      setSuccess(`Downloading ${exportRecord.name}...`);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Download failed');
    }
  };

  const handleDeleteExport = async (exportId: number) => {
    if (!window.confirm('Are you sure you want to delete this export?')) {
      return;
    }

    try {
      // await api.delete(`/exports/${exportId}`);
      setRecentExports(recentExports.filter(exp => exp.id !== exportId));
      setSuccess('Export deleted successfully');
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to delete export');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusBadge = (status: ExportRecord['status']) => {
    const statusClasses = {
      completed: 'status-badge status-completed',
      processing: 'status-badge status-processing',
      failed: 'status-badge status-failed'
    };

    return (
      <span className={statusClasses[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="export-center">
      <div className="export-center-header">
        <h2>Export Center</h2>
        <button 
          className="primary-button"
          onClick={() => setShowExportDialog(true)}
        >
          + New Export
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {success && (
        <div className="success-message">{success}</div>
      )}

      <div className="export-tabs">
        <button 
          className={`tab-button ${activeTab === 'exports' ? 'active' : ''}`}
          onClick={() => setActiveTab('exports')}
        >
          Recent Exports
        </button>
        <button 
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
        <button 
          className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Scheduled Exports
        </button>
      </div>

      <div className="export-content">
        {activeTab === 'exports' && (
          <div className="exports-list">
            {loading ? (
              <div className="loading-message">Loading exports...</div>
            ) : recentExports.length === 0 ? (
              <div className="empty-state">
                <p>No exports yet</p>
                <button 
                  className="primary-button"
                  onClick={() => setShowExportDialog(true)}
                >
                  Create Your First Export
                </button>
              </div>
            ) : (
              <div className="export-cards">
                {recentExports.map(exportRecord => (
                  <div key={exportRecord.id} className="export-card">
                    <div className="export-card-header">
                      <h3>{exportRecord.name}</h3>
                      {getStatusBadge(exportRecord.status)}
                    </div>
                    <div className="export-card-details">
                      <span className="export-detail">
                        <strong>Format:</strong> {exportRecord.format.toUpperCase()}
                      </span>
                      <span className="export-detail">
                        <strong>Type:</strong> {exportRecord.dataType}
                      </span>
                      <span className="export-detail">
                        <strong>Size:</strong> {exportRecord.size}
                      </span>
                      <span className="export-detail">
                        <strong>Created:</strong> {formatDate(exportRecord.createdAt)}
                      </span>
                    </div>
                    <div className="export-card-actions">
                      {exportRecord.status === 'completed' && (
                        <button 
                          className="secondary-button"
                          onClick={() => handleDownload(exportRecord)}
                        >
                          Download
                        </button>
                      )}
                      <button 
                        className="danger-button"
                        onClick={() => handleDeleteExport(exportRecord.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="templates-list">
            <div className="templates-header">
              <p>Export templates help you quickly generate reports with predefined settings.</p>
              <button 
                className="secondary-button"
                onClick={() => setShowTemplateDialog(true)}
              >
                + Create Template
              </button>
            </div>
            {templates.length === 0 ? (
              <div className="empty-state">
                <p>No templates available</p>
              </div>
            ) : (
              <div className="template-cards">
                {templates.map(template => (
                  <div key={template.id} className="template-card">
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                    <div className="template-details">
                      <span><strong>Format:</strong> {template.format.toUpperCase()}</span>
                    </div>
                    <button 
                      className="primary-button"
                      onClick={() => {
                        // Use template for export
                        setShowExportDialog(true);
                      }}
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="schedule-section">
            <div className="schedule-header">
              <p>Schedule automatic exports to be generated at regular intervals.</p>
              <button className="secondary-button">+ Schedule Export</button>
            </div>
            <div className="empty-state">
              <p>No scheduled exports configured</p>
              <p className="empty-state-hint">Create a schedule to automatically generate reports daily, weekly, or monthly.</p>
            </div>
          </div>
        )}
      </div>

      {showExportDialog && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          onExport={handleExport}
          title="New Export"
          dataType={selectedExportType}
        />
      )}
    </div>
  );
};

export default ExportCenter;
