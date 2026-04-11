import React, { useRef, useState } from 'react';
import type { Series, SeriesCreatePayload } from '../types/series';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

type SeriesDialogProps = {
  isOpen: boolean;
  series?: Series;
  onClose: () => void;
  onSave: (payload: SeriesCreatePayload) => Promise<void>;
  saving?: boolean;
};

const REGION_OPTIONS = ['National', 'Flanders', 'Wallonia', 'Brussels', 'Provincial'];

const SeriesDialog: React.FC<SeriesDialogProps> = ({ isOpen, series, onClose, onSave, saving = false }) => {
  const [name, setName] = useState(series?.name || '');
  const [level, setLevel] = useState(series ? String(series.level) : '1');
  const [region, setRegion] = useState(series?.region || 'National');
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName(series?.name || '');
    setLevel(series ? String(series.level) : '1');
    setRegion(series?.region || 'National');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const { dialogRef, titleId, onDialogKeyDown } = useAccessibleDialog({
    isOpen,
    onClose: handleClose,
    initialFocusRef: nameInputRef,
  });

  if (!isOpen) {
    return null;
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const numericLevel = Number(level);

    if (!trimmedName) {
      setError('Series name is required');
      return;
    }

    if (!Number.isInteger(numericLevel) || numericLevel < 1) {
      setError('Level must be a positive integer');
      return;
    }

    try {
      await onSave({
        name: trimmedName,
        level: numericLevel,
        region: region.trim() || null,
      });
      handleClose();
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to save series');
    }
  };

  return (
    <div className="series-dialog__backdrop" role="presentation" onClick={handleClose}>
      <div
        ref={dialogRef}
        className="series-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <h3 id={titleId}>{series ? 'Edit Series' : 'Create Series'}</h3>

        <form onSubmit={submit}>
          <label htmlFor="series-name">Series name</label>
          <input
            ref={nameInputRef}
            id="series-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Eerste Klasse"
            maxLength={255}
            aria-invalid={error === 'Series name is required' ? 'true' : 'false'}
            aria-describedby={error === 'Series name is required' ? 'series-name-error' : undefined}
          />

          <label htmlFor="series-level">Level</label>
          <input
            id="series-level"
            type="number"
            min={1}
            step={1}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            aria-invalid={error === 'Level must be a positive integer' ? 'true' : 'false'}
            aria-describedby={error === 'Level must be a positive integer' ? 'series-level-error' : undefined}
          />

          <label htmlFor="series-region">Region</label>
          <input
            id="series-region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            list="series-region-options"
            placeholder="National"
          />
          <datalist id="series-region-options">
            {REGION_OPTIONS.map((option) => (
              <option value={option} key={option} />
            ))}
          </datalist>

          {error && (
            <div
              className="series-dialog__error"
              id={error === 'Series name is required' ? 'series-name-error' : error === 'Level must be a positive integer' ? 'series-level-error' : undefined}
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="series-dialog__actions">
            <button type="button" className="secondary-button" onClick={handleClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SeriesDialog;
