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
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [editorDraft, setEditorDraft] = useState<ReportTemplateDraft>(createEmptyTemplateDraft());
  const [editorKey, setEditorKey] = useState('template-new');

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

  const showLoadErrorState = Boolean(error && templates.length === 0);

  if (loading) {
    return (
      <div className="report-templates-page">
        <header className="report-templates-page__header">
          <div>
            <h1>Report Templates</h1>
            <p>Loading your template library</p>
          </div>
        </header>
        <StatePanel
          variant="loading"
          title="Loading report templates"
          message="Preparing the saved layouts and the template editor."
        />
      </div>
    );
  }

  return (
    <div className="report-templates-page">
      <header className="report-templates-page__header">
        <div>
          <h1>Report Templates</h1>
          <p>{templateSummary}</p>
        </div>

        <button type="button" className="report-templates__primary-action" onClick={() => openCreate()}>
          + New Template
        </button>
      </header>

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
          ) : templates.length === 0 ? (
            <StatePanel
              variant="empty"
              title="No templates yet"
              message="Create your first report template to define reusable report layouts."
              actionLabel="Create template"
              onAction={() => openCreate()}
            />
          ) : (
            <div className="report-templates-page__list">
              {templates.map((template) => (
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
  );
};

export default ReportTemplates;