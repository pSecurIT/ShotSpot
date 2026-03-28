import React, { useState } from 'react';
import type { Series, SeriesCreatePayload } from '../types/series';

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
      onClose();
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to save series');
    }
  };

  return (
    <div className="series-dialog__backdrop" role="presentation" onClick={onClose}>
      <div
        className="series-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="series-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="series-dialog-title">{series ? 'Edit Series' : 'Create Series'}</h3>

        <form onSubmit={submit}>
          <label htmlFor="series-name">Series name</label>
          <input
            id="series-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Eerste Klasse"
            maxLength={255}
          />

          <label htmlFor="series-level">Level</label>
          <input
            id="series-level"
            type="number"
            min={1}
            step={1}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
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

          {error && <div className="series-dialog__error" role="alert">{error}</div>}

          <div className="series-dialog__actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
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
