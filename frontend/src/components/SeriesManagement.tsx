import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seriesApi } from '../services/seriesApi';
import type { Series, SeriesCreatePayload, SeriesDetail } from '../types/series';
import SeriesDialog from './SeriesDialog';
import '../styles/SeriesManagement.css';

const SeriesManagement: React.FC = () => {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<SeriesDetail | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<number | null>(null);

  const orderedSeries = useMemo(() => {
    return [...series].sort((left, right) => left.level - right.level);
  }, [series]);

  const loadSeries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await seriesApi.list();
      setSeries(response);
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to load series');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSeries();
  }, []);

  const openCreate = () => {
    setSelectedSeries(undefined);
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (item: Series) => {
    setSelectedSeries(item);
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const onSave = async (payload: SeriesCreatePayload) => {
    setSaving(true);
    setError(null);

    try {
      if (selectedSeries) {
        await seriesApi.update(selectedSeries.id, payload);
        setSuccess('Series updated successfully');
      } else {
        await seriesApi.create(payload);
        setSuccess('Series created successfully');
      }
      await loadSeries();
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to save series');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (item: Series) => {
    setError(null);
    setSuccess(null);

    const ok = window.confirm(`Delete ${item.name}?`);
    if (!ok) {
      return;
    }

    try {
      await seriesApi.delete(item.id);
      setSuccess('Series deleted successfully');
      if (expandedId === item.id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      await loadSeries();
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to delete series');
    }
  };

  const changeOrder = async (index: number, direction: -1 | 1) => {
    const current = orderedSeries[index];
    const neighbor = orderedSeries[index + direction];

    if (!current || !neighbor) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await seriesApi.update(current.id, { level: neighbor.level });
      await seriesApi.update(neighbor.id, { level: current.level });
      setSuccess('Series order updated');
      await loadSeries();
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to reorder series');
    }
  };

  const toggleCompetitions = async (item: Series) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }

    setLoadingDetailId(item.id);
    setError(null);

    try {
      const detail = await seriesApi.getById(item.id);
      setExpandedId(item.id);
      setExpandedDetail(detail);
    } catch (err) {
      const nextError = err as Error;
      setError(nextError.message || 'Failed to load series competitions');
    } finally {
      setLoadingDetailId(null);
    }
  };

  return (
    <div className="series-management">
      <div className="series-management__header">
        <h2>Series / Divisions Management</h2>
        <button type="button" className="primary-button" onClick={openCreate}>
          Create Series
        </button>
      </div>

      <p className="series-management__subtitle">
        Manage Belgian korfball division hierarchy, level ordering, and regional assignments.
      </p>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status" aria-live="polite">{success}</div>}

      {loading ? (
        <div className="series-management__loading" role="status" aria-live="polite">Loading series…</div>
      ) : orderedSeries.length === 0 ? (
        <div className="empty-state" role="status" aria-live="polite">No series found</div>
      ) : (
        <div className="series-management__table-wrap">
          <table className="series-management__table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Series</th>
                <th>Region</th>
                <th>Competitions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedSeries.map((item, index) => {
                const isExpanded = expandedId === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <tr>
                      <td>{item.level}</td>
                      <td>{item.name}</td>
                      <td>{item.region || 'Unassigned'}</td>
                      <td>{item.competition_count || 0}</td>
                      <td>
                        <div className="series-management__actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => changeOrder(index, -1)}
                            disabled={index === 0}
                            aria-label={`Move ${item.name} up`}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => changeOrder(index, 1)}
                            disabled={index === orderedSeries.length - 1}
                            aria-label={`Move ${item.name} down`}
                          >
                            Down
                          </button>
                          <button type="button" className="secondary-button" onClick={() => openEdit(item)}>
                            Edit
                          </button>
                          <button type="button" className="secondary-button" onClick={() => void onDelete(item)}>
                            Delete
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void toggleCompetitions(item)}
                            disabled={loadingDetailId === item.id}
                          >
                            {isExpanded ? 'Hide Competitions' : 'View Competitions'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="series-management__detail-row">
                        <td colSpan={5}>
                          {expandedDetail?.competitions.length ? (
                            <ul className="series-management__competition-list">
                              {expandedDetail.competitions.map((competition) => (
                                <li key={competition.id}>
                                  <strong>{competition.name}</strong>
                                  <span>{competition.competition_type} • {competition.status}</span>
                                  {competition.id ? (
                                    <Link to={`/competitions/${competition.id}/standings`}>
                                      Open competition
                                    </Link>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="series-management__empty-inline">No competitions linked to this series.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <SeriesDialog
          key={selectedSeries ? `edit-${selectedSeries.id}` : 'create'}
          isOpen={dialogOpen}
          series={selectedSeries}
          saving={saving}
          onClose={() => {
            setDialogOpen(false);
            setSelectedSeries(undefined);
          }}
          onSave={onSave}
        />
      )}
    </div>
  );
};

export default SeriesManagement;
