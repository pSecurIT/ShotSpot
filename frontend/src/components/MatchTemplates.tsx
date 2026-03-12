import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import '../styles/MatchTemplates.css';

interface MatchTemplate {
  id: number;
  name: string;
  description: string | null;
  number_of_periods: number;
  period_duration_minutes: number;
  competition_type: string | null;
  is_system_template: boolean;
  created_by: number | null;
  created_by_username?: string;
  created_at: string;
  updated_at: string;
  allow_same_team: boolean;
}

interface MatchTemplatesProps {
  onSelectTemplate?: (template: MatchTemplate) => void;
  selectionMode?: boolean;
}

const MatchTemplates: React.FC<MatchTemplatesProps> = ({ 
  onSelectTemplate,
  selectionMode = false 
}) => {
  const [templates, setTemplates] = useState<MatchTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MatchTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    number_of_periods: 4,
    period_duration_minutes: 10,
    competition_type: '',
    allow_same_team: false
  });

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/match-templates');
      setTemplates(response.data);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load match templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      number_of_periods: 4,
      period_duration_minutes: 10,
      competition_type: '',
      allow_same_team: false
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const dataToSend = {
        ...formData,
        competition_type: formData.competition_type || undefined
      };

      if (editingTemplate) {
        await api.put(`/match-templates/${editingTemplate.id}`, dataToSend);
        setSuccess('Template updated successfully');
      } else {
        await api.post('/match-templates', dataToSend);
        setSuccess('Template created successfully');
      }

      await fetchTemplates();
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Failed to save template');
    }
  };

  const handleEdit = (template: MatchTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      number_of_periods: template.number_of_periods,
      period_duration_minutes: template.period_duration_minutes,
      competition_type: template.competition_type || '',
      allow_same_team: template.allow_same_team || false
    });
    setShowForm(true);
  };

  const handleDelete = async (template: MatchTemplate) => {
    if (template.is_system_template) {
      setError('System templates cannot be deleted');
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/match-templates/${template.id}`);
      setSuccess('Template deleted successfully');
      await fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleClone = async (template: MatchTemplate) => {
    try {
      const response = await api.post(`/match-templates/${template.id}/clone`, {});
      setSuccess(`Template "${template.name}" cloned successfully`);
      await fetchTemplates();
      
      // Optionally open the cloned template for editing
      const clonedTemplate = response.data;
      setEditingTemplate(clonedTemplate);
      setFormData({
        name: clonedTemplate.name,
        description: clonedTemplate.description || '',
        number_of_periods: clonedTemplate.number_of_periods,
        period_duration_minutes: clonedTemplate.period_duration_minutes,
        competition_type: clonedTemplate.competition_type || '',
        allow_same_team: clonedTemplate.allow_same_team || false
      });
      setShowForm(true);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Failed to clone template');
    }
  };

  const handleSelectTemplate = (template: MatchTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    }
  };

  const formatCompetitionType = (type: string | null): string => {
    if (!type) return '-';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const systemTemplates = templates.filter(t => t.is_system_template);
  const userTemplates = templates.filter(t => !t.is_system_template);

  if (loading) {
    return <div className="loading">Loading templates...</div>;
  }

  return (
    <div className="match-templates-container">
      <div className="match-templates-header">
        <h2>📋 Match Templates</h2>
        {!selectionMode && (
          <button 
            className="primary-button"
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
          >
            {showForm ? 'Cancel' : '+ New Template'}
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showForm && !selectionMode && (
        <form onSubmit={handleSubmit} className="template-form">
          <h3>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h3>
          
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="template-name">Template Name *</label>
              <input
                id="template-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>
            
            <div className="form-field">
              <label htmlFor="competition-type">Competition Type</label>
              <select
                id="competition-type"
                value={formData.competition_type}
                onChange={(e) => setFormData({ ...formData, competition_type: e.target.value })}
              >
                <option value="">Select type</option>
                <option value="league">League</option>
                <option value="cup">Cup</option>
                <option value="tournament">Tournament</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="template-description">Description</label>
            <textarea
              id="template-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="form-section">
            <h4>⏱️ Period Settings</h4>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="num-periods">Number of Periods</label>
                <input
                  id="num-periods"
                  type="number"
                  value={formData.number_of_periods}
                  onChange={(e) => setFormData({ ...formData, number_of_periods: parseInt(e.target.value) || 4 })}
                  min={1}
                  max={10}
                />
              </div>
              
              <div className="form-field">
                <label htmlFor="period-duration">Period Duration (minutes)</label>
                <input
                  id="period-duration"
                  type="number"
                  value={formData.period_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, period_duration_minutes: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={60}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>🏆 Match Rules</h4>
            <div className="form-field checkbox-field">
              <label htmlFor="allow-same-team">
                <input
                  id="allow-same-team"
                  type="checkbox"
                  checked={formData.allow_same_team}
                  onChange={(e) => setFormData({ ...formData, allow_same_team: e.target.checked })}
                />
                <span>Allow teams to play against themselves (practice matches)</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button">
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* System Templates */}
      <div className="templates-section">
        <h3>📌 System Templates</h3>
        <p className="section-description">Pre-configured templates for common match formats</p>
        
        <div className="templates-grid">
          {systemTemplates.map(template => (
            <div key={template.id} className="template-card system-template">
              <div className="template-header">
                <h4>{template.name}</h4>
                {template.competition_type && (
                  <span className={`competition-badge ${template.competition_type}`}>
                    {formatCompetitionType(template.competition_type)}
                  </span>
                )}
              </div>
              
              {template.description && (
                <p className="template-description">{template.description}</p>
              )}
              
              <div className="template-details">
                <div className="detail-row">
                  <span className="detail-label">⏱️ Periods:</span>
                  <span className="detail-value">
                    {template.number_of_periods} × {template.period_duration_minutes} min
                  </span>
                </div>
                {template.allow_same_team && (
                  <div className="detail-row">
                    <span className="detail-label">✅ Same team allowed</span>
                  </div>
                )}
              </div>
              
              <div className="template-actions">
                {selectionMode ? (
                  <button 
                    className="primary-button"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    Use Template
                  </button>
                ) : (
                  <>
                    <button 
                      className="secondary-button"
                      onClick={() => handleClone(template)}
                      title="Clone this template to customize it"
                    >
                      📋 Clone
                    </button>
                    <span className="system-badge">System Template</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Templates */}
      {userTemplates.length > 0 && (
        <div className="templates-section">
          <h3>👤 My Templates</h3>
          <p className="section-description">Custom templates you&apos;ve created</p>
          
          <div className="templates-grid">
            {userTemplates.map(template => (
              <div key={template.id} className="template-card user-template">
                <div className="template-header">
                  <h4>{template.name}</h4>
                  {template.competition_type && (
                    <span className={`competition-badge ${template.competition_type}`}>
                      {formatCompetitionType(template.competition_type)}
                    </span>
                  )}
                </div>
                
                {template.description && (
                  <p className="template-description">{template.description}</p>
                )}
                
                <div className="template-details">
                  <div className="detail-row">
                    <span className="detail-label">⏱️ Periods:</span>
                    <span className="detail-value">
                      {template.number_of_periods} × {template.period_duration_minutes} min
                    </span>
                  </div>
                </div>
                
                <div className="template-actions">
                  {selectionMode ? (
                    <button 
                      className="primary-button"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      Use Template
                    </button>
                  ) : (
                    <>
                      <button 
                        className="secondary-button"
                        onClick={() => handleEdit(template)}
                      >
                        Edit
                      </button>
                      <button 
                        className="danger-button"
                        onClick={() => handleDelete(template)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectionMode && userTemplates.length === 0 && (
        <div className="empty-state">
          <p>You haven&apos;t created any custom templates yet.</p>
          <button 
            className="primary-button"
            onClick={() => setShowForm(true)}
          >
            Create Your First Template
          </button>
        </div>
      )}
    </div>
  );
};

export default MatchTemplates;
