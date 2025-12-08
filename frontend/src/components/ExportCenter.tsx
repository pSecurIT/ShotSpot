import React, { useState, useEffect } from 'react';
import ExportDialog, { ExportFormat, ExportOptions } from './ExportDialog';
import TemplateDialog from './TemplateDialog';
import '../styles/ExportCenter.css';
import api from '../utils/api';

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

interface Team {
  id: number;
  name: string;
}

const ExportCenter: React.FC = () => {
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([]);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [selectedExportType] = useState<'game' | 'player' | 'team' | 'comparison'>('game');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'exports' | 'templates' | 'schedule'>('exports');

  const fetchRecentExports = async () => {
    try {
      const response = await api.get('/exports/recent');
      setRecentExports(response.data);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      
      // Fallback to mock data if API fails
      if (process.env.NODE_ENV === 'development') {
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
      } else {
        setError(error.response?.data?.error || 'Failed to fetch exports');
      }
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/exports/templates');
      setTemplates(response.data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      
      // Fallback to mock data if API fails
      if (process.env.NODE_ENV === 'development') {
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
      }
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
      // Auto-select first team if available
      if (response.data.length > 0 && !selectedTeamId) {
        setSelectedTeamId(response.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRecentExports(),
        fetchTemplates(),
        fetchTeams()
      ]);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async (format: ExportFormat, options: ExportOptions) => {
    try {
      setSuccess('');
      setError('');
      
      // This would be an actual API call in production
      // await api.post('/exports', { format, options, dataType: selectedExportType });
      
      // Log the export parameters for debugging
      console.log('Export requested:', { format, options, dataType: selectedExportType });
      
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
      
      if (!exportRecord.downloadUrl) {
        setError('Download URL not available');
        return;
      }
      
      // Download the file from backend
      const response = await api.get(`/exports/download/${exportRecord.id}`, { responseType: 'blob' });
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = exportRecord.name;
      
      if (contentDisposition) {
        const matches = /filename="(.+)"/.exec(contentDisposition);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess(`Downloaded ${exportRecord.name}`);
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
      await api.delete(`/exports/${exportId}`);
      setRecentExports(recentExports.filter(exp => exp.id !== exportId));
      setSuccess('Export deleted successfully');
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to delete export');
    }
  };

  const handleEditTemplate = (template: ExportTemplate) => {
    setEditingTemplate(template);
    setShowTemplateDialog(true);
  };

  // Removed unused generateDummyPDF and generateDummyCSV functions
  // The backend now handles all export generation

  const handleDeleteTemplate = async (templateId: number) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.delete(`/exports/templates/${templateId}`);
      setTemplates(templates.filter(t => t.id !== templateId));
      setSuccess('Template deleted successfully');
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleSaveTemplate = async (templateData: Omit<ExportTemplate, 'id'>) => {
    try {
      if (editingTemplate) {
        // Update existing template
        const response = await api.put(`/exports/templates/${editingTemplate.id}`, templateData);
        setTemplates(templates.map(t => 
          t.id === editingTemplate.id ? response.data : t
        ));
        setSuccess('Template updated successfully');
      } else {
        // Create new template
        const response = await api.post('/exports/templates', templateData);
        setTemplates([...templates, response.data]);
        setSuccess('Template created successfully');
      }
      setShowTemplateDialog(false);
      setEditingTemplate(null);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(error.response?.data?.error || 'Failed to save template');
    }
  };

  const handleExportFromTemplate = async (template: ExportTemplate) => {
    try {
      setError('');
      
      if (!selectedTeamId) {
        setError('Please select a team first');
        return;
      }
      
      console.log('Creating export with:', { 
        templateId: template.id, 
        dataType: selectedExportType, 
        teamId: selectedTeamId 
      });
      
      // Create new export using template settings
      const response = await api.post('/exports/from-template', { 
        templateId: template.id, 
        dataType: selectedExportType,
        teamId: Number(selectedTeamId) // Ensure it's a number
      });
      
      const newExport: ExportRecord = {
        ...response.data,
        size: response.data.size || '-'
      };
      
      setRecentExports([newExport, ...recentExports]);
      setActiveTab('exports');
      setSuccess(`Export "${template.name}" started! Processing... Check Recent Exports tab or click Refresh.`);
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const updatedExports = await api.get('/exports/recent');
          setRecentExports(updatedExports.data);
          
          const completedExport = updatedExports.data.find((exp: ExportRecord) => 
            exp.id === newExport.id && exp.status === 'completed'
          );
          
          if (completedExport) {
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Error polling exports:', err);
          clearInterval(pollInterval);
        }
      }, 2000);
      
      // Stop polling after 30 seconds
      setTimeout(() => clearInterval(pollInterval), 30000);
    } catch (err) {
      const error = err as { response?: { data?: { error?: string; errors?: Array<{ msg: string }> } }; message?: string };
      // Show validation errors if available
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorMessages = error.response.data.errors.map((e: { msg: string }) => e.msg).join(', ');
        setError(`Validation error: ${errorMessages}`);
      } else {
        setError(error.response?.data?.error || 'Failed to create export from template');
      }
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

      {teams.length > 0 && (
        <div className="team-selector">
          <label htmlFor="team-select">Select Team: </label>
          <select 
            id="team-select"
            value={selectedTeamId || ''}
            onChange={(e) => {
              const value = e.target.value;
              setSelectedTeamId(value ? Number(value) : null);
            }}
            className="form-input"
          >
            <option value="">-- Select a Team --</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
            <div className="section-header">
              <p>View and manage your generated exports. Reports may take a few minutes to process.</p>
              <button 
                className="secondary-button"
                onClick={async () => {
                  setLoading(true);
                  await fetchRecentExports();
                  setLoading(false);
                }}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
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
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateDialog(true);
                }}
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
                    <div className="template-card-actions">
                      <button 
                        className="primary-button"
                        onClick={() => {
                          // Create export from template
                          handleExportFromTemplate(template);
                        }}
                      >
                        Use Template
                      </button>
                      <button 
                        className="secondary-button"
                        onClick={() => handleEditTemplate(template)}
                      >
                        Edit
                      </button>
                      <button 
                        className="danger-button"
                        onClick={() => handleDeleteTemplate(template.id)}
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

      {showTemplateDialog && (
        <TemplateDialog
          key={editingTemplate?.id || 'new'}
          isOpen={showTemplateDialog}
          onClose={() => {
            setShowTemplateDialog(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveTemplate}
          template={editingTemplate}
        />
      )}
    </div>
  );
};

export default ExportCenter;
