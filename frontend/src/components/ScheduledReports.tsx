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

  if (loading) {
    return <div className="scheduled-reports-page" role="status" aria-live="polite">Loading scheduled reports...</div>;
  }

  return (
    <div className="scheduled-reports-page">
      <div className="scheduled-reports-header">
        <div>
          <h2>Scheduled Reports</h2>
          <p>{scheduleCountLabel}</p>
        </div>
        <button type="button" onClick={handleOpenCreate}>+ New Schedule</button>
      </div>

      {error && <div className="scheduled-reports-banner scheduled-reports-banner--error" role="alert">{error}</div>}
      {success && <div className="scheduled-reports-banner scheduled-reports-banner--success" role="status" aria-live="polite">{success}</div>}

      {scheduledReports.length === 0 ? (
        <div className="scheduled-reports-empty" role="status" aria-live="polite">
          <h3>No schedules configured yet</h3>
          <p>Create a schedule to automate recurring report delivery.</p>
          <button type="button" onClick={handleOpenCreate}>Create First Schedule</button>
        </div>
      ) : (
        <div className="scheduled-reports-list" aria-label="Scheduled reports list">
          {scheduledReports.map((schedule) => {
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
    </div>
  );
};

export default ScheduledReports;
