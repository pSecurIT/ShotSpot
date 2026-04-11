import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Club } from '../types/clubs';
import { clubsApi } from '../services/clubsApi';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

interface ClubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  club?: Club;
}

const validateName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return 'Club name is required';
  if (trimmed.length < 2) return 'Minimum 2 characters';
  if (trimmed.length > 100) return 'Maximum 100 characters';
  return null;
};

const ClubDialog: React.FC<ClubDialogProps> = ({ isOpen, onClose, onSuccess, club }) => {
  const isEdit = useMemo(() => Boolean(club), [club]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { dialogRef, titleId, onDialogKeyDown } = useAccessibleDialog({
    isOpen,
    onClose,
    initialFocusRef: nameInputRef,
  });

  useEffect(() => {
    if (isOpen) {
      setName(club?.name ?? '');
      setFormError(null);
      setFieldError(null);
    }
  }, [isOpen, club]);

  if (!isOpen) return null;

  const title = isEdit ? 'Edit Club' : 'Add Club';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const error = validateName(name);
    setFieldError(error);
    if (error) return;

    try {
      setSubmitting(true);
      if (club) {
        await clubsApi.update(club.id, { name: name.trim() });
      } else {
        await clubsApi.create({ name: name.trim() });
      }
      onSuccess();
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setFormError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to save club');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="club-dialog__overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="club-dialog__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onDialogKeyDown}
        tabIndex={-1}
      >
        <div className="club-dialog__header">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="secondary-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="club-dialog__field">
            <label htmlFor="club-name">Club name</label>
            <input
              ref={nameInputRef}
              id="club-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="Enter club name"
              disabled={submitting}
              className={fieldError ? 'error' : ''}
              aria-invalid={fieldError ? 'true' : 'false'}
              aria-describedby={fieldError ? 'club-name-error' : undefined}
            />
            {fieldError && <span className="field-error" id="club-name-error">{fieldError}</span>}
          </div>

          <div className="club-dialog__actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClubDialog;
