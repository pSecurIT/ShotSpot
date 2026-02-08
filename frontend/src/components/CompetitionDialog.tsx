import React, { useEffect, useMemo, useState } from 'react';
import type { Competition, CompetitionCreate, CompetitionFormatConfig, CompetitionStatus, CompetitionType } from '../types/competitions';
import type { Season } from '../types/seasons';
import type { Series } from '../types/series';
import { competitionsApi } from '../services/competitionsApi';
import { seasonsApi } from '../services/seasonsApi';
import { seriesApi } from '../services/seriesApi';

interface CompetitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  competition?: Competition;
}

type FormState = {
  name: string;
  type: CompetitionType;
  start_date: string;
  end_date: string;
  season_id: string;
  series_id: string;
  status: CompetitionStatus;
  description: string;

  bracket_type: 'single_elimination' | 'double_elimination';
  points_win: string;
  points_draw: string;
  points_loss: string;
};

const validate = (form: FormState): Record<string, string> => {
  const errors: Record<string, string> = {};

  const name = form.name.trim();
  if (!name) errors.name = 'Competition name is required';
  else if (name.length < 3) errors.name = 'Minimum 3 characters';

  if (!form.start_date) errors.start_date = 'Start date is required';

  if (form.end_date && form.start_date && form.end_date < form.start_date) {
    errors.end_date = 'End date cannot be before start date';
  }

  return errors;
};

const toOptionalInt = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const toOptionalIntOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const CompetitionDialog: React.FC<CompetitionDialogProps> = ({ isOpen, onClose, onSuccess, competition }) => {
  const isEdit = useMemo(() => Boolean(competition), [competition]);

  const [form, setForm] = useState<FormState>({
    name: '',
    type: 'tournament',
    start_date: '',
    end_date: '',
    season_id: '',
    series_id: '',
    status: 'upcoming',
    description: '',
    bracket_type: 'single_elimination',
    points_win: '3',
    points_draw: '1',
    points_loss: '0',
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [series, setSeries] = useState<Series[]>([]);

  const sortedSeasons = useMemo(() => {
    return [...seasons].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      const dateOrder = b.start_date.localeCompare(a.start_date);
      if (dateOrder !== 0) return dateOrder;
      return a.name.localeCompare(b.name);
    });
  }, [seasons]);

  const sortedSeries = useMemo(() => {
    return [...series].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
  }, [series]);

  useEffect(() => {
    if (!isOpen) return;

    const cfg = competition?.format_config ?? {};

    setForm({
      name: competition?.name ?? '',
      type: competition?.type ?? 'tournament',
      start_date: competition?.start_date?.slice(0, 10) ?? '',
      end_date: competition?.end_date?.slice(0, 10) ?? '',
      season_id: competition?.season_id ? String(competition.season_id) : '',
      series_id: competition?.series_id ? String(competition.series_id) : '',
      status: competition?.status ?? 'upcoming',
      description: competition?.description ?? '',
      bracket_type: (cfg.bracket_type as FormState['bracket_type']) ?? 'single_elimination',
      points_win: typeof cfg.points_win === 'number' ? String(cfg.points_win) : '3',
      points_draw: typeof cfg.points_draw === 'number' ? String(cfg.points_draw) : '1',
      points_loss: typeof cfg.points_loss === 'number' ? String(cfg.points_loss) : '0',
    });

    setFormError(null);
    setFieldErrors({});
  }, [isOpen, competition]);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const loadOptions = async () => {
      setOptionsLoading(true);
      setOptionsError(null);

      try {
        const [seasonData, seriesData] = await Promise.all([seasonsApi.list(), seriesApi.list()]);
        if (!isMounted) return;
        setSeasons(seasonData);
        setSeries(seriesData);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load seasons or series';
        setOptionsError(message);
      } finally {
        if (isMounted) setOptionsLoading(false);
      }
    };

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const title = isEdit ? 'Edit Competition' : 'Create Competition';

  const update = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const buildFormatConfig = (): CompetitionFormatConfig => {
    if (form.type === 'tournament') {
      return { bracket_type: form.bracket_type };
    }

    const points_win = Number(form.points_win);
    const points_draw = Number(form.points_draw);
    const points_loss = Number(form.points_loss);

    return {
      points_win: Number.isFinite(points_win) ? points_win : 3,
      points_draw: Number.isFinite(points_draw) ? points_draw : 1,
      points_loss: Number.isFinite(points_loss) ? points_loss : 0,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSubmitting(true);

      if (competition) {
        await competitionsApi.update(competition.id, {
          name: form.name.trim(),
          start_date: form.start_date,
          end_date: form.end_date.trim() ? form.end_date : undefined,
          season_id: toOptionalIntOrNull(form.season_id),
          series_id: toOptionalIntOrNull(form.series_id),
          status: form.status,
          description: form.description.trim() ? form.description.trim() : undefined,
          format_config: buildFormatConfig(),
        });
      } else {
        const payload: CompetitionCreate = {
          name: form.name.trim(),
          type: form.type,
          start_date: form.start_date,
          end_date: form.end_date.trim() ? form.end_date : undefined,
          season_id: toOptionalInt(form.season_id),
          series_id: toOptionalInt(form.series_id),
          description: form.description.trim() ? form.description.trim() : undefined,
          format_config: buildFormatConfig(),
        };

        await competitionsApi.create(payload);
      }

      onSuccess();
    } catch (err) {
      const errorObj = err as { response?: { data?: { error?: string; details?: string } }; message?: string };
      setFormError(errorObj.response?.data?.error || errorObj.response?.data?.details || 'Failed to save competition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="competition-dialog__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="competition-dialog__content">
        <div className="competition-dialog__header">
          <h3>{title}</h3>
          <button type="button" className="secondary-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {formError && <div className="alert alert-error">{formError}</div>}
        {optionsError && <div className="alert alert-error">{optionsError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="competition-dialog__grid">
            <div className="competition-dialog__field">
              <label htmlFor="competition-name">Competition name</label>
              <input
                id="competition-name"
                type="text"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                className={fieldErrors.name ? 'error' : ''}
                disabled={submitting}
                autoFocus
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </div>

            {!isEdit && (
              <div className="competition-dialog__field">
                <label htmlFor="competition-type">Competition type</label>
                <select
                  id="competition-type"
                  value={form.type}
                  onChange={(e) => update({ type: e.target.value as CompetitionType })}
                  disabled={submitting}
                >
                  <option value="tournament">Tournament</option>
                  <option value="league">League</option>
                </select>
              </div>
            )}

            <div className="competition-dialog__field">
              <label htmlFor="competition-start">Start date</label>
              <input
                id="competition-start"
                type="date"
                value={form.start_date}
                onChange={(e) => update({ start_date: e.target.value })}
                className={fieldErrors.start_date ? 'error' : ''}
                disabled={submitting}
              />
              {fieldErrors.start_date && <span className="field-error">{fieldErrors.start_date}</span>}
            </div>

            <div className="competition-dialog__field">
              <label htmlFor="competition-end">End date (optional)</label>
              <input
                id="competition-end"
                type="date"
                value={form.end_date}
                onChange={(e) => update({ end_date: e.target.value })}
                className={fieldErrors.end_date ? 'error' : ''}
                disabled={submitting}
              />
              {fieldErrors.end_date && <span className="field-error">{fieldErrors.end_date}</span>}
            </div>

            <div className="competition-dialog__field">
              <label htmlFor="competition-season">Season (optional)</label>
              <select
                id="competition-season"
                value={form.season_id}
                onChange={(e) => update({ season_id: e.target.value })}
                disabled={submitting || optionsLoading}
              >
                <option value="">No season</option>
                {sortedSeasons.map((season) => {
                  const range = `${season.start_date} - ${season.end_date}`;
                  const activeTag = season.is_active ? ' (active)' : '';
                  return (
                    <option key={season.id} value={String(season.id)}>
                      {season.name} ({range}){activeTag}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="competition-dialog__field">
              <label htmlFor="competition-series">Series (optional)</label>
              <select
                id="competition-series"
                value={form.series_id}
                onChange={(e) => update({ series_id: e.target.value })}
                disabled={submitting || optionsLoading}
              >
                <option value="">No series</option>
                {sortedSeries.map((seriesItem) => (
                  <option key={seriesItem.id} value={String(seriesItem.id)}>
                    Level {seriesItem.level} - {seriesItem.name}
                  </option>
                ))}
              </select>
            </div>

            {isEdit && (
              <div className="competition-dialog__field">
                <label htmlFor="competition-status">Status</label>
                <select
                  id="competition-status"
                  value={form.status}
                  onChange={(e) => update({ status: e.target.value as CompetitionStatus })}
                  disabled={submitting}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          <div className="competition-dialog__field">
            <label htmlFor="competition-description">Description (optional)</label>
            <textarea
              id="competition-description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              disabled={submitting}
              rows={3}
            />
          </div>

          <div className="competition-dialog__section">
            <h4>Format configuration</h4>

            {form.type === 'tournament' && (
              <div className="competition-dialog__field">
                <label htmlFor="competition-bracket">Bracket type</label>
                <select
                  id="competition-bracket"
                  value={form.bracket_type}
                  onChange={(e) => update({ bracket_type: e.target.value as FormState['bracket_type'] })}
                  disabled={submitting}
                >
                  <option value="single_elimination">Single elimination</option>
                  <option value="double_elimination">Double elimination</option>
                </select>
              </div>
            )}

            {form.type === 'league' && (
              <div className="competition-dialog__grid">
                <div className="competition-dialog__field">
                  <label htmlFor="points-win">Points (win)</label>
                  <input
                    id="points-win"
                    type="number"
                    value={form.points_win}
                    onChange={(e) => update({ points_win: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="competition-dialog__field">
                  <label htmlFor="points-draw">Points (draw)</label>
                  <input
                    id="points-draw"
                    type="number"
                    value={form.points_draw}
                    onChange={(e) => update({ points_draw: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="competition-dialog__field">
                  <label htmlFor="points-loss">Points (loss)</label>
                  <input
                    id="points-loss"
                    type="number"
                    value={form.points_loss}
                    onChange={(e) => update({ points_loss: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="competition-dialog__actions">
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

export default CompetitionDialog;
