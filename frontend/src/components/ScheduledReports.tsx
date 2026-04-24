import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { scheduledReportsApi } from '../services/scheduledReportsApi';
import type {
  ReportTemplateOption,
  ScheduleType,
  ScheduledReport,
  ScheduledReportPayload,
  TeamOption,
} from '../types/scheduled-reports';
import ReportScheduleDialog from './ReportScheduleDialog';
import ExecutionHistory from './ExecutionHistory';
import StatePanel from './ui/StatePanel';
import Toast from './ui/Toast';
import PageLayout from './ui/PageLayout';
import useBreadcrumbs from '../hooks/useBreadcrumbs';
import '../styles/ScheduledReports.css';

const scheduleTypeLabel: Record<ScheduleType, string> = {
  after_match: 'After Match',
  weekly: 'Weekly',
  monthly: 'Monthly',
  season_end: 'Season End',
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return 'Not scheduled';
  }
  return new Date(value).toLocaleString();
};

const computeFallbackNextRun = (schedule: ScheduledReport): string => {
  if (schedule.next_run_at) {
    return formatDateTime(schedule.next_run_at);
  }

  if (!schedule.is_active) {
    return 'Disabled';
  }

  if (schedule.schedule_type === 'after_match') {
    return 'After next completed match';
  }

  return 'Pending recalculation';
};

const ScheduledReports: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplateOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [historyScheduleId, setHistoryScheduleId] = useState<number | null>(null);
  const [busyScheduleId, setBusyScheduleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ScheduleType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'next_run_asc' | 'updated_desc'>('next_run_asc');

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [schedules, templatesResponse, teamsResponse] = await Promise.all([
        scheduledReportsApi.getAll(),
        api.get<ReportTemplateOption[]>('/report-templates?is_active=true'),
        api.get<TeamOption[]>('/teams'),
      ]);

      setScheduledReports(schedules);
      setTemplates(templatesResponse.data);
      setTeams(teamsResponse.data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load scheduled reports');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  const clearFeedback = () => {
    setError('');
    setSuccess('');
  };

  const handleOpenCreate = () => {
    clearFeedback();
    setEditingSchedule(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (schedule: ScheduledReport) => {
    clearFeedback();
    setEditingSchedule(schedule);
    setIsDialogOpen(true);
  };

  const handleSaveSchedule = async (payload: ScheduledReportPayload, id?: number) => {
    clearFeedback();

    if (id) {
      await scheduledReportsApi.update(id, payload);
      setSuccess('Scheduled report updated successfully');
    } else {
      await scheduledReportsApi.create(payload);
      setSuccess('Scheduled report created successfully');
    }

    await loadAllData();
  };

  const handleToggleActive = async (schedule: ScheduledReport) => {
    clearFeedback();
    setBusyScheduleId(schedule.id);

    try {
      await scheduledReportsApi.update(schedule.id, { is_active: !schedule.is_active });
      setSuccess(`Schedule ${schedule.is_active ? 'disabled' : 'enabled'} successfully`);
      await loadAllData();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update schedule status');
      }
    } finally {
      setBusyScheduleId(null);
    }
  };

  const handleRunNow = async (schedule: ScheduledReport) => {
    clearFeedback();
    setBusyScheduleId(schedule.id);

    try {
      await scheduledReportsApi.runNow(schedule.id);
      setSuccess('Scheduled report triggered successfully');
      await loadAllData();
      setHistoryScheduleId(schedule.id);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to run scheduled report');
      }
    } finally {
      setBusyScheduleId(null);
    }
  };

  const handleDelete = async (schedule: ScheduledReport) => {
    if (!window.confirm(`Delete schedule "${schedule.name}"?`)) {
      return;
    }

    clearFeedback();
    setBusyScheduleId(schedule.id);

    try {
      await scheduledReportsApi.remove(schedule.id);
      setSuccess('Scheduled report deleted successfully');
      if (historyScheduleId === schedule.id) {
        setHistoryScheduleId(null);
      }
      await loadAllData();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to delete scheduled report');
      }
    } finally {
      setBusyScheduleId(null);
    }
  };

  const scheduleCountLabel = useMemo(() => {
    const activeCount = scheduledReports.filter((item) => item.is_active).length;
    return `${activeCount} active of ${scheduledReports.length} schedules`;
  }, [scheduledReports]);

  const filteredSchedules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = scheduledReports.filter((schedule) => {
      if (typeFilter !== 'all' && schedule.schedule_type !== typeFilter) {
        return false;
      }

      if (statusFilter === 'active' && !schedule.is_active) {
        return false;
      }

      if (statusFilter === 'inactive' && schedule.is_active) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        schedule.name.toLowerCase().includes(query)
        || (schedule.template_name || '').toLowerCase().includes(query)
        || (schedule.team_name || 'all teams').toLowerCase().includes(query)
        || scheduleTypeLabel[schedule.schedule_type].toLowerCase().includes(query)
      );
    });

    return result.sort((left, right) => {
      if (sortBy === 'name_asc') {
        return left.name.localeCompare(right.name);
      }

      if (sortBy === 'updated_desc') {
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }

      const leftRun = left.next_run_at ? new Date(left.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightRun = right.next_run_at ? new Date(right.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
      return leftRun - rightRun;
    });
  }, [scheduledReports, searchQuery, typeFilter, statusFilter, sortBy]);

  const hasActiveRefinements = Boolean(searchQuery.trim() || typeFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'next_run_asc');

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    const sortLabelMap: Record<'name_asc' | 'next_run_asc' | 'updated_desc', string> = {
      name_asc: 'Name A-Z',
      next_run_asc: 'Next run soonest',
      updated_desc: 'Recently updated'
    };

    if (searchQuery.trim()) {
      chips.push(`Search: ${searchQuery.trim()}`);
    }
    if (typeFilter !== 'all') {
      chips.push(`Type: ${scheduleTypeLabel[typeFilter]}`);
    }
    if (statusFilter !== 'all') {
      chips.push(`Status: ${statusFilter}`);
    }
    if (sortBy !== 'next_run_asc') {
      chips.push(`Sort: ${sortLabelMap[sortBy]}`);
    }

    return chips;
  }, [searchQuery, typeFilter, statusFilter, sortBy]);

  const clearAllRefinements = useCallback(() => {
    setSearchQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSortBy('next_run_asc');
  }, []);

  const showLoadErrorState = Boolean(error && scheduledReports.length === 0);

  if (loading) {
    return (
      <PageLayout
        title="Scheduled Reports"
        eyebrow="Settings > Scheduled Reports"
        description="Automate report generation and delivery workflows."
        breadcrumbs={breadcrumbs}
      >
        <div className="scheduled-reports-page">
          <StatePanel
            variant="loading"
            title="Loading scheduled reports"
            message="Pulling schedules, templates, teams, and execution history entry points together."
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Scheduled Reports"
      eyebrow="Settings > Scheduled Reports"
      description={scheduleCountLabel}
      breadcrumbs={breadcrumbs}
      actions={<button type="button" onClick={handleOpenCreate}>+ New Schedule</button>}
    >
      <div className="scheduled-reports-page">

      {!showLoadErrorState && error && (
        <StatePanel
          variant="error"
          title="Scheduled report action failed"
          message={error}
          actionLabel="Reload schedules"
          onAction={() => {
            void loadAllData();
          }}
          compact
          className="scheduled-reports__feedback"
        />
      )}

      {!showLoadErrorState && (
        <div className="search-filters-container">
          <div className="search-box">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="search-input"
              placeholder="Search schedules, templates, teams, or schedule type"
              aria-label="Search scheduled reports"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchQuery('')}
                aria-label="Clear scheduled report search"
                title="Clear search"
              >
                x
              </button>
            )}
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <label htmlFor="scheduled_reports_type_filter">Type</label>
              <select
                id="scheduled_reports_type_filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as 'all' | ScheduleType)}
                className="filter-select"
              >
                <option value="all">All types</option>
                <option value="after_match">After Match</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="season_end">Season End</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="scheduled_reports_status_filter">Status</label>
              <select
                id="scheduled_reports_status_filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                className="filter-select"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="scheduled_reports_sort">Sort by</label>
              <select
                id="scheduled_reports_sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as 'name_asc' | 'next_run_asc' | 'updated_desc')}
                className="filter-select"
              >
                <option value="next_run_asc">Next run soonest</option>
                <option value="updated_desc">Recently updated</option>
                <option value="name_asc">Name A-Z</option>
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

          <div className="active-filters" aria-label="Active scheduled report filters">
            {activeFilterChips.length > 0 ? (
              activeFilterChips.map((chip) => (
                <span key={chip} className="active-filter-chip">{chip}</span>
              ))
            ) : (
              <span className="active-filter-chip active-filter-chip--muted">No active filters</span>
            )}
          </div>

          <div className="results-count" aria-live="polite">
            Showing {filteredSchedules.length} of {scheduledReports.length} schedules
          </div>
        </div>
      )}

      {showLoadErrorState ? (
        <StatePanel
          variant="error"
          title="Couldn’t load scheduled reports"
          message={error}
          actionLabel="Retry"
          onAction={() => {
            void loadAllData();
          }}
        />
      ) : filteredSchedules.length === 0 ? (
        <StatePanel
          variant="empty"
          title={hasActiveRefinements ? 'No schedules match your filters' : 'No schedules configured yet'}
          message={hasActiveRefinements ? 'Try broadening your search or clear all filters to find the right schedule.' : 'Create a schedule to automate recurring report delivery.'}
          actionLabel={hasActiveRefinements ? 'Clear all filters' : 'Create First Schedule'}
          onAction={hasActiveRefinements ? clearAllRefinements : handleOpenCreate}
          className="scheduled-reports-empty"
        />
      ) : (
        <div className="scheduled-reports-list" aria-label="Scheduled reports list">
          {filteredSchedules.map((schedule) => {
            const isBusy = busyScheduleId === schedule.id;
            const isHistoryOpen = historyScheduleId === schedule.id;

            return (
              <section key={schedule.id} className="scheduled-reports-card">
                <div className="scheduled-reports-card__top">
                  <div>
                    <h3>{schedule.name}</h3>
                    <p>
                      {scheduleTypeLabel[schedule.schedule_type]} • Template: {schedule.template_name || `#${schedule.template_id}`}
                    </p>
                  </div>
                  <label className="scheduled-reports-toggle">
                    <input
                      type="checkbox"
                      checked={schedule.is_active}
                      onChange={() => void handleToggleActive(schedule)}
                      disabled={isBusy}
                    />
                    <span>{schedule.is_active ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>

                <div className="scheduled-reports-card__meta">
                  <div>
                    <strong>Recipients:</strong> {schedule.send_email ? (schedule.email_recipients?.join(', ') || 'None') : 'Email disabled'}
                  </div>
                  <div>
                    <strong>Team:</strong> {schedule.team_name || 'All teams'}
                  </div>
                  <div>
                    <strong>Last run:</strong> {formatDateTime(schedule.last_run_at)}
                  </div>
                  <div>
                    <strong>Next run:</strong> {computeFallbackNextRun(schedule)}
                  </div>
                </div>

                <div className="scheduled-reports-card__actions">
                  <button type="button" onClick={() => handleOpenEdit(schedule)} disabled={isBusy}>Edit</button>
                  <button type="button" onClick={() => void handleRunNow(schedule)} disabled={isBusy}>Run Now</button>
                  <button
                    type="button"
                    onClick={() => setHistoryScheduleId(isHistoryOpen ? null : schedule.id)}
                    disabled={isBusy}
                  >
                    {isHistoryOpen ? 'Hide History' : 'View History'}
                  </button>
                  <button type="button" onClick={() => void handleDelete(schedule)} disabled={isBusy}>Delete</button>
                </div>

                {isHistoryOpen && <ExecutionHistory scheduleId={schedule.id} />}
              </section>
            );
          })}
        </div>
      )}

      <ReportScheduleDialog
        isOpen={isDialogOpen}
        templates={templates}
        teams={teams}
        initialSchedule={editingSchedule}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveSchedule}
      />

      {success && (
        <Toast
          title="Schedule updated"
          message={success}
          onDismiss={() => setSuccess('')}
        />
      )}
      </div>
    </PageLayout>
  );
};

export default ScheduledReports;
