import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TemplateBuilder from './TemplateBuilder';
import { reportTemplatesApi } from '../services/reportTemplatesApi';
import type { ReportTemplate, ReportTemplateDraft } from '../types/report-templates';
import {
  buildReportTemplatePayload,
  createDuplicateTemplateDraft,
  createEmptyTemplateDraft,
} from '../types/report-templates';
import StatePanel from './ui/StatePanel';
import Toast from './ui/Toast';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import '../styles/ReportTemplates.css';

const formatDate = (value?: string) => {
  if (!value) {
    return 'Just now';
  }

  return new Date(value).toLocaleString();
};

const downloadJson = (template: ReportTemplate) => {
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'report-template'}.json`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

const ReportTemplates: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [editorDraft, setEditorDraft] = useState<ReportTemplateDraft>(createEmptyTemplateDraft());
  const [editorKey, setEditorKey] = useState('template-new');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'summary' | 'detailed' | 'coach_focused' | 'custom'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'default' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'updated_desc' | 'name_asc' | 'sections_desc'>('updated_desc');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const openCreate = useCallback((draft: ReportTemplateDraft = createEmptyTemplateDraft()) => {
    setMode('create');
    setSelectedTemplateId(null);
    setEditorDraft(draft);
    setEditorKey(`template-new-${Date.now()}`);
  }, []);

  const openEdit = useCallback((template: ReportTemplate) => {
    setMode('edit');
    setSelectedTemplateId(template.id);
    setEditorDraft(template);
    setEditorKey(`template-${template.id}-${template.updated_at || Date.now()}`);
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const loadedTemplates = await reportTemplatesApi.getAll();
      setTemplates(loadedTemplates);

      if (loadedTemplates.length > 0) {
        openEdit(loadedTemplates[0]);
      } else {
        openCreate();
      }
    } catch (loadError) {
      if (loadError instanceof Error) {
        setError(loadError.message);
      } else {
        setError('Failed to load report templates');
      }
    } finally {
      setLoading(false);
    }
  }, [openCreate, openEdit]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const clearFeedback = () => {
    setError('');
    setSuccess('');
  };

  const handleSave = async (draft: ReportTemplateDraft) => {
    clearFeedback();

    const payload = buildReportTemplatePayload(draft);

    if (mode === 'edit' && draft.id) {
      const updatedTemplate = await reportTemplatesApi.update(draft.id, payload);
      setTemplates((currentTemplates) => currentTemplates.map((template) => (
        template.id === updatedTemplate.id ? updatedTemplate : template
      )));
      setSuccess('Template updated successfully');
      openEdit(updatedTemplate);
      return;
    }

    const createdTemplate = await reportTemplatesApi.create(payload);
    setTemplates((currentTemplates) => [createdTemplate, ...currentTemplates]);
    setSuccess('Template created successfully');
    openEdit(createdTemplate);
  };

  const handleDuplicate = async (template: ReportTemplate) => {
    clearFeedback();
    const duplicatedTemplate = await reportTemplatesApi.create(buildReportTemplatePayload(createDuplicateTemplateDraft(template)));
    setTemplates((currentTemplates) => [duplicatedTemplate, ...currentTemplates]);
    setSuccess(`Template "${template.name}" duplicated successfully`);
    openEdit(duplicatedTemplate);
  };

  const handleDelete = async (template: ReportTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) {
      return;
    }

    clearFeedback();
    await reportTemplatesApi.remove(template.id);
    const nextTemplates = templates.filter((item) => item.id !== template.id);
    setTemplates(nextTemplates);
    setSuccess('Template deleted successfully');

    if (nextTemplates.length > 0) {
      openEdit(nextTemplates[0]);
    } else {
      openCreate();
    }
  };

  const templateSummary = useMemo(() => {
    const customCount = templates.filter((template) => !template.is_default).length;
    return `${templates.length} templates, ${customCount} custom`; 
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = templates.filter((template) => {
      if (typeFilter !== 'all' && template.type !== typeFilter) {
        return false;
      }

      if (scopeFilter === 'default' && !template.is_default) {
        return false;
      }

      if (scopeFilter === 'custom' && template.is_default) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        template.name.toLowerCase().includes(query)
        || (template.description || '').toLowerCase().includes(query)
        || template.type.toLowerCase().includes(query)
      );
    });

    return result.sort((left, right) => {
      if (sortBy === 'name_asc') {
        return left.name.localeCompare(right.name);
      }

      if (sortBy === 'sections_desc') {
        return right.sections.length - left.sections.length;
      }

      return new Date(right.updated_at || right.created_at || 0).getTime() - new Date(left.updated_at || left.created_at || 0).getTime();
    });
  }, [templates, searchQuery, typeFilter, scopeFilter, sortBy]);

  const hasActiveRefinements = Boolean(searchQuery.trim() || typeFilter !== 'all' || scopeFilter !== 'all' || sortBy !== 'updated_desc');

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    const sortLabelMap: Record<'updated_desc' | 'name_asc' | 'sections_desc', string> = {
      updated_desc: 'Recently updated',
      name_asc: 'Name A-Z',
      sections_desc: 'Most sections'
    };

    if (searchQuery.trim()) {
      chips.push(`Search: ${searchQuery.trim()}`);
    }
    if (typeFilter !== 'all') {
      chips.push(`Type: ${typeFilter.replace('_', ' ')}`);
    }
    if (scopeFilter !== 'all') {
      chips.push(`Scope: ${scopeFilter}`);
    }
    if (sortBy !== 'updated_desc') {
      chips.push(`Sort: ${sortLabelMap[sortBy]}`);
    }

    return chips;
  }, [searchQuery, typeFilter, scopeFilter, sortBy]);

  const clearAllRefinements = useCallback(() => {
    setSearchQuery('');
    setTypeFilter('all');
    setScopeFilter('all');
    setSortBy('updated_desc');
  }, []);

  const showLoadErrorState = Boolean(error && templates.length === 0);

  if (loading) {
    return (
      <PageLayout
        title="Report Templates"
        eyebrow="Settings > Report Templates"
        description="Design, duplicate, and manage reusable report layouts."
        breadcrumbs={breadcrumbs}
      >
        <div className="report-templates-page">
          <StatePanel
            variant="loading"
            title="Loading report templates"
            message="Preparing the saved layouts and the template editor."
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Report Templates"
      eyebrow="Settings > Report Templates"
      description={templateSummary}
      breadcrumbs={breadcrumbs}
      actions={(
        <button type="button" className="report-templates__primary-action" onClick={() => openCreate()}>
          + New Template
        </button>
      )}
    >
      <div className="report-templates-page">

      {!showLoadErrorState && error && (
        <StatePanel
          variant="error"
          title="Template action failed"
          message={error}
          actionLabel="Reload templates"
          onAction={() => {
            void loadTemplates();
          }}
          compact
          className="report-templates__feedback"
        />
      )}

      <div className="report-templates-page__layout">
        <aside className="report-templates-page__sidebar">
          <div className="report-templates-page__sidebar-header">
            <h2>Existing Templates</h2>
            <p>Select a template to preview or edit it.</p>
          </div>

          {!showLoadErrorState && (
            <div className="search-filters-container">
              <div className="search-box">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="search-input"
                  placeholder="Search templates by name, type, or description"
                  aria-label="Search report templates"
                />
                {searchQuery.trim() && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear template search"
                    title="Clear search"
                  >
                    x
                  </button>
                )}
              </div>

              <div className="filters-row">
                <div className="filter-group">
                  <label htmlFor="report_template_type_filter">Type</label>
                  <select
                    id="report_template_type_filter"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as 'all' | 'summary' | 'detailed' | 'coach_focused' | 'custom')}
                    className="filter-select"
                  >
                    <option value="all">All types</option>
                    <option value="summary">Summary</option>
                    <option value="detailed">Detailed</option>
                    <option value="coach_focused">Coach focused</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="report_template_scope_filter">Scope</label>
                  <select
                    id="report_template_scope_filter"
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value as 'all' | 'default' | 'custom')}
                    className="filter-select"
                  >
                    <option value="all">All templates</option>
                    <option value="default">Default templates</option>
                    <option value="custom">Custom templates</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label htmlFor="report_template_sort">Sort by</label>
                  <select
                    id="report_template_sort"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as 'updated_desc' | 'name_asc' | 'sections_desc')}
                    className="filter-select"
                  >
                    <option value="updated_desc">Recently updated</option>
                    <option value="name_asc">Name A-Z</option>
                    <option value="sections_desc">Most sections</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={clearAllRefinements}
                  className="secondary-button"
                  disabled={!hasActiveRefinements}
                >
                  Clear all
                </button>
              </div>

              <div className="active-filters" aria-label="Active report template filters">
                {activeFilterChips.length > 0 ? (
                  activeFilterChips.map((chip) => (
                    <span key={chip} className="active-filter-chip">{chip}</span>
                  ))
                ) : (
                  <span className="active-filter-chip active-filter-chip--muted">No active filters</span>
                )}
              </div>

              <div className="results-count" aria-live="polite">
                Showing {filteredTemplates.length} of {templates.length} templates
              </div>
            </div>
          )}

          {showLoadErrorState ? (
            <StatePanel
              variant="error"
              title="Couldn’t load templates"
              message={error}
              actionLabel="Retry"
              onAction={() => {
                void loadTemplates();
              }}
            />
          ) : filteredTemplates.length === 0 ? (
            <StatePanel
              variant="empty"
              title={hasActiveRefinements ? 'No templates match these filters' : 'No templates yet'}
              message={hasActiveRefinements ? 'Try broadening your search or clear all filters to find the right template.' : 'Create your first report template to define reusable report layouts.'}
              actionLabel={hasActiveRefinements ? 'Clear all filters' : 'Create template'}
              onAction={hasActiveRefinements ? clearAllRefinements : () => openCreate()}
            />
          ) : (
            <div className="report-templates-page__list">
              {filteredTemplates.map((template) => (
                <article
                  key={template.id}
                  className={`report-templates-page__list-item ${selectedTemplateId === template.id ? 'is-selected' : ''}`}
                >
                  <button type="button" className="report-templates-page__list-select" onClick={() => openEdit(template)}>
                    <div className="report-templates-page__list-heading">
                      <h3>{template.name}</h3>
                      {template.is_default && <span className="report-templates-page__badge">Default</span>}
                    </div>
                    <p>{template.description || 'No description provided.'}</p>
                    <dl>
                      <div>
                        <dt>Type</dt>
                        <dd>{template.type.replace(/_/g, ' ')}</dd>
                      </div>
                      <div>
                        <dt>Sections</dt>
                        <dd>{template.sections.length}</dd>
                      </div>
                      <div>
                        <dt>Updated</dt>
                        <dd>{formatDate(template.updated_at)}</dd>
                      </div>
                    </dl>
                  </button>

                  <div className="report-templates-page__list-actions">
                    <button type="button" onClick={() => handleDuplicate(template)}>Duplicate</button>
                    <button type="button" onClick={() => downloadJson(template)}>Export JSON</button>
                    {!template.is_default && (
                      <button type="button" className="is-danger" onClick={() => handleDelete(template)}>
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>

        <main className="report-templates-page__main">
          <TemplateBuilder
            key={editorKey}
            initialDraft={editorDraft}
            mode={mode}
            readOnly={Boolean(selectedTemplate?.is_default && mode === 'edit')}
            onSave={handleSave}
            onDuplicate={selectedTemplate ? () => { void handleDuplicate(selectedTemplate); } : undefined}
          />
        </main>
      </div>

      {success && (
        <Toast
          title="Template saved"
          message={success}
          onDismiss={() => setSuccess('')}
        />
      )}
      </div>
    </PageLayout>
  );
};

export default ReportTemplates;