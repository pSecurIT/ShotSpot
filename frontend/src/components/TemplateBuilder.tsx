import React, { useEffect, useMemo, useState } from 'react';
import TemplatePreview from './TemplatePreview';
import TemplateSectionEditor from './TemplateSectionEditor';
import type { ReportTemplateDraft, ReportTemplateSection, TemplateSectionType } from '../types/report-templates';
import {
  buildReportTemplatePayload,
  cloneTemplateDraft,
  collectMetricsFromSections,
  createEmptyTemplateDraft,
  createTemplateSection,
  reorderSections,
  REPORT_TEMPLATE_TYPE_OPTIONS,
  SECTION_TYPE_OPTIONS,
} from '../types/report-templates';

interface TemplateBuilderProps {
  initialDraft?: ReportTemplateDraft | null;
  mode: 'create' | 'edit';
  readOnly?: boolean;
  onSave: (draft: ReportTemplateDraft) => Promise<void>;
  onDuplicate?: () => void;
}

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  initialDraft,
  mode,
  readOnly = false,
  onSave,
  onDuplicate,
}) => {
  const [draft, setDraft] = useState<ReportTemplateDraft>(() => cloneTemplateDraft(initialDraft) || createEmptyTemplateDraft());
  const [selectedSectionId, setSelectedSectionId] = useState<string>(draft.sections[0]?.id || '');
  const [newSectionType, setNewSectionType] = useState<TemplateSectionType>('stats');
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const nextDraft = cloneTemplateDraft(initialDraft) || createEmptyTemplateDraft();
    setDraft(nextDraft);
    setSelectedSectionId(nextDraft.sections[0]?.id || '');
    setError('');
  }, [initialDraft]);

  const selectedSection = useMemo(
    () => draft.sections.find((section) => section.id === selectedSectionId) || draft.sections[0] || null,
    [draft.sections, selectedSectionId],
  );

  const updateDraft = (updates: Partial<ReportTemplateDraft>) => {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        ...updates,
      };

      nextDraft.metrics = collectMetricsFromSections(nextDraft.sections);
      return nextDraft;
    });
  };

  const handleSectionUpdate = (updatedSection: ReportTemplateSection) => {
    updateDraft({
      sections: draft.sections.map((section) => (section.id === updatedSection.id ? updatedSection : section)),
    });
  };

  const handleAddSection = () => {
    const nextSection = createTemplateSection(newSectionType);
    updateDraft({ sections: [...draft.sections, nextSection] });
    setSelectedSectionId(nextSection.id);
  };

  const handleDeleteSection = (sectionId: string) => {
    const nextSections = draft.sections.filter((section) => section.id !== sectionId);
    updateDraft({ sections: nextSections });

    if (selectedSectionId === sectionId) {
      setSelectedSectionId(nextSections[0]?.id || '');
    }
  };

  const moveSection = (fromIndex: number, toIndex: number) => {
    updateDraft({ sections: reorderSections(draft.sections, fromIndex, toIndex) });
  };

  const handleDrop = (targetIndex: number) => {
    if (!draggingSectionId) {
      return;
    }

    const fromIndex = draft.sections.findIndex((section) => section.id === draggingSectionId);
    moveSection(fromIndex, targetIndex);
    setDraggingSectionId(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readOnly) {
      return;
    }

    if (!draft.name.trim()) {
      setError('Template name is required.');
      return;
    }

    if (draft.sections.length === 0) {
      setError('Add at least one section before saving.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave({
        ...draft,
        metrics: buildReportTemplatePayload(draft).metrics,
      });
    } catch (saveError) {
      if (saveError instanceof Error) {
        setError(saveError.message);
      } else {
        setError('Failed to save template.');
      }
    } finally {
      setSaving(false);
    }
  };

  const heading = mode === 'create' ? 'Create Report Template' : draft.is_default ? 'View Report Template' : 'Edit Report Template';

  return (
    <div className="report-templates__builder-shell">
      <form className="report-templates__builder" onSubmit={handleSave}>
        <header className="report-templates__builder-header">
          <div>
            <h2>{heading}</h2>
            <p>
              {readOnly
                ? 'Default templates are read-only. Duplicate this template to customize it.'
                : 'Arrange sections, tune their configuration, and preview the report layout.'}
            </p>
          </div>

          {!readOnly ? (
            <button type="submit" className="report-templates__primary-action" disabled={saving}>
              {saving ? 'Saving...' : mode === 'create' ? 'Save Template' : 'Save Changes'}
            </button>
          ) : (
            <button type="button" className="report-templates__secondary-action" onClick={onDuplicate}>
              Duplicate Template
            </button>
          )}
        </header>

        {error && <div className="report-templates__banner report-templates__banner--error">{error}</div>}

        <div className="report-templates__builder-grid">
          <section className="report-templates__panel report-templates__panel--details">
            <label className="report-templates__field">
              <span>Template Name</span>
              <input
                value={draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                disabled={readOnly}
                maxLength={100}
                required
              />
            </label>

            <label className="report-templates__field">
              <span>Template Type</span>
              <select
                value={draft.type}
                onChange={(event) => updateDraft({ type: event.target.value as typeof draft.type })}
                disabled={readOnly}
              >
                {REPORT_TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="report-templates__field">
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={(event) => updateDraft({ description: event.target.value })}
                disabled={readOnly}
                rows={4}
                maxLength={500}
              />
            </label>

            <div className="report-templates__field-group">
              <label className="report-templates__field">
                <span>Add Section Type</span>
                <select
                  value={newSectionType}
                  onChange={(event) => setNewSectionType(event.target.value as TemplateSectionType)}
                  disabled={readOnly}
                >
                  {SECTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="report-templates__secondary-action"
                onClick={handleAddSection}
                disabled={readOnly}
              >
                Add Section
              </button>
            </div>

            <div className="report-templates__section-list" aria-label="Template Sections">
              {draft.sections.map((section, index) => (
                <article
                  key={section.id}
                  className={`report-templates__section-card ${selectedSection?.id === section.id ? 'is-selected' : ''}`}
                  draggable={!readOnly}
                  onDragStart={() => setDraggingSectionId(section.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(index)}
                >
                  <button
                    type="button"
                    className="report-templates__section-main"
                    onClick={() => setSelectedSectionId(section.id)}
                  >
                    <span className="report-templates__section-index">{index + 1}</span>
                    <span>
                      <strong>{section.title}</strong>
                      <small>{section.type}</small>
                    </span>
                  </button>

                  <div className="report-templates__section-actions">
                    <button type="button" onClick={() => moveSection(index, index - 1)} disabled={readOnly || index === 0}>
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(index, index + 1)}
                      disabled={readOnly || index === draft.sections.length - 1}
                    >
                      Down
                    </button>
                    <button type="button" onClick={() => handleDeleteSection(section.id)} disabled={readOnly}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="report-templates__panel-stack">
            {selectedSection ? (
              <TemplateSectionEditor section={selectedSection} disabled={readOnly} onChange={handleSectionUpdate} />
            ) : (
              <section className="report-templates__panel report-templates__panel--empty">
                <h3>No section selected</h3>
                <p>Add a section to begin building this template.</p>
              </section>
            )}

            <TemplatePreview draft={draft} />
          </div>
        </div>
      </form>
    </div>
  );
};

export default TemplateBuilder;