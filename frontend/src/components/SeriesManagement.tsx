import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { seriesApi } from '../services/seriesApi';
import type { Series, SeriesCreatePayload, SeriesDetail } from '../types/series';
import SeriesDialog from './SeriesDialog';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import '../styles/SeriesManagement.css';

const SeriesManagement: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();

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
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | string>('all');
  const [competitionFilter, setCompetitionFilter] = useState<'all' | 'with' | 'without'>('all');
  const [sortBy, setSortBy] = useState<'level_asc' | 'name_asc' | 'competitions_desc'>('level_asc');

  const filteredSeries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = series.filter((item) => {
      if (regionFilter !== 'all' && (item.region || 'Unassigned') !== regionFilter) {
        return false;
      }

      const competitionCount = Number(item.competition_count || 0);
      if (competitionFilter === 'with' && competitionCount <= 0) {
        return false;
      }

      if (competitionFilter === 'without' && competitionCount > 0) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        item.name.toLowerCase().includes(query)
        || (item.region || 'unassigned').toLowerCase().includes(query)
        || String(item.level).includes(query)
      );
    });

    return result.sort((left, right) => {
      if (sortBy === 'name_asc') {
        return left.name.localeCompare(right.name);
      }

      if (sortBy === 'competitions_desc') {
        return Number(right.competition_count || 0) - Number(left.competition_count || 0);
      }

      return left.level - right.level;
    });
  }, [series, searchQuery, regionFilter, competitionFilter, sortBy]);

  const regionOptions = useMemo(() => {
    return Array.from(new Set(series.map((item) => item.region || 'Unassigned'))).sort((left, right) => left.localeCompare(right));
  }, [series]);

  const hasActiveRefinements = Boolean(searchQuery.trim() || regionFilter !== 'all' || competitionFilter !== 'all' || sortBy !== 'level_asc');
  const canReorder = !hasActiveRefinements;

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    const sortLabelMap: Record<'level_asc' | 'name_asc' | 'competitions_desc', string> = {
      level_asc: 'Level ascending',
      name_asc: 'Name A-Z',
      competitions_desc: 'Most competitions'
    };

    if (searchQuery.trim()) {
      chips.push(`Search: ${searchQuery.trim()}`);
    }
    if (regionFilter !== 'all') {
      chips.push(`Region: ${regionFilter}`);
    }
    if (competitionFilter !== 'all') {
      chips.push(`Competitions: ${competitionFilter === 'with' ? 'With linked competitions' : 'Without linked competitions'}`);
    }
    if (sortBy !== 'level_asc') {
      chips.push(`Sort: ${sortLabelMap[sortBy]}`);
    }

    return chips;
  }, [searchQuery, regionFilter, competitionFilter, sortBy]);

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
    const current = filteredSeries[index];
    const neighbor = filteredSeries[index + direction];

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

  const clearAllRefinements = () => {
    setSearchQuery('');
    setRegionFilter('all');
    setCompetitionFilter('all');
    setSortBy('level_asc');
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
    <PageLayout
      title="Series / Divisions Management"
      eyebrow="Data > Series / Divisions"
      description="Manage Belgian korfball division hierarchy, level ordering, and regional assignments."
      breadcrumbs={breadcrumbs}
      actions={(
        <button type="button" className="primary-button" onClick={openCreate}>
          Create Series
        </button>
      )}
    >
      <div className="series-management">
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {success && <div className="alert alert-success" role="status" aria-live="polite">{success}</div>}

        {!loading && (
          <div className="search-filters-container">
            <div className="search-box">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="search-input"
                placeholder="Search series by name, region, or level"
                aria-label="Search series"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear series search"
                  title="Clear search"
                >
                  x
                </button>
              )}
            </div>

            <div className="filters-row">
              <div className="filter-group">
                <label htmlFor="series_region_filter">Region filter</label>
                <select
                  id="series_region_filter"
                  value={regionFilter}
                  onChange={(event) => setRegionFilter(event.target.value)}
                  className="filter-select"
                >
                  <option value="all">All regions</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="series_competition_filter">Competitions</label>
                <select
                  id="series_competition_filter"
                  value={competitionFilter}
                  onChange={(event) => setCompetitionFilter(event.target.value as 'all' | 'with' | 'without')}
                  className="filter-select"
                >
                  <option value="all">All series</option>
                  <option value="with">With competitions</option>
                  <option value="without">Without competitions</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="series_sort">Sort by</label>
                <select
                  id="series_sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'level_asc' | 'name_asc' | 'competitions_desc')}
                  className="filter-select"
                >
                  <option value="level_asc">Level ascending</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="competitions_desc">Most competitions</option>
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

            <div className="active-filters" aria-label="Active series filters">
              {activeFilterChips.length > 0 ? (
                activeFilterChips.map((chip) => (
                  <span key={chip} className="active-filter-chip">{chip}</span>
                ))
              ) : (
                <span className="active-filter-chip active-filter-chip--muted">No active filters</span>
              )}
            </div>

            <div className="results-count" aria-live="polite">
              Showing {filteredSeries.length} of {series.length} series
            </div>
          </div>
        )}

        {loading ? (
          <div className="series-management__loading" role="status" aria-live="polite">Loading series...</div>
        ) : filteredSeries.length === 0 ? (
          <div className="empty-state" role="status" aria-live="polite">
            {hasActiveRefinements ? 'No series match the current filters' : 'No series found'}
            {hasActiveRefinements && (
              <div style={{ marginTop: '0.75rem' }}>
                <button type="button" className="secondary-button" onClick={clearAllRefinements}>Clear all filters</button>
              </div>
            )}
          </div>
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
                {filteredSeries.map((item, index) => {
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
                              disabled={index === 0 || !canReorder}
                              aria-label={`Move ${item.name} up`}
                              title={canReorder ? `Move ${item.name} up` : 'Clear filters and sorting to reorder levels'}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => changeOrder(index, 1)}
                              disabled={index === filteredSeries.length - 1 || !canReorder}
                              aria-label={`Move ${item.name} down`}
                              title={canReorder ? `Move ${item.name} down` : 'Clear filters and sorting to reorder levels'}
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
                                    <span>{competition.competition_type} - {competition.status}</span>
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
    </PageLayout>
  );
};

export default SeriesManagement;
