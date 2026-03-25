import React, { useMemo, useState } from 'react';
import TimeSchedulePicker from './TimeSchedulePicker';
import type {
  ReportTemplateOption,
  ScheduleType,
  ScheduledReport,
  ScheduledReportPayload,
  TeamOption,
} from '../types/scheduled-reports';

interface ScheduleConfigFormProps {
  templates: ReportTemplateOption[];
  teams: TeamOption[];
  initialSchedule?: ScheduledReport | null;
  onSubmit: (payload: ScheduledReportPayload, id?: number) => Promise<void>;
  onCancel: () => void;
}

type GameStatusFilter = 'all' | 'scheduled' | 'completed';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const scheduleTypeLabel: Record<ScheduleType, string> = {
  after_match: 'After Match',
  weekly: 'Weekly',
  monthly: 'Monthly',
  season_end: 'Season End',
};

const getInitialScheduleOptions = (initialSchedule?: ScheduledReport | null) => {
  const scheduleOptions = initialSchedule?.game_filters?.schedule_options;
  return {
    weeklyDay: typeof scheduleOptions?.weeklyDay === 'number' ? scheduleOptions.weeklyDay : 1,
    monthlyDay: typeof scheduleOptions?.monthlyDay === 'number' ? scheduleOptions.monthlyDay : 1,
    hour: typeof scheduleOptions?.hour === 'number' ? scheduleOptions.hour : 9,
    minute: typeof scheduleOptions?.minute === 'number' ? scheduleOptions.minute : 0,
  };
};

const getInitialFilterOptions = (initialSchedule?: ScheduledReport | null) => {
  const filters = initialSchedule?.game_filters?.filters as {
    game_status?: GameStatusFilter;
    last_n_days?: number;
    include_practice?: boolean;
  } | undefined;

  return {
    gameStatus: filters?.game_status || 'all',
    lastNDays: typeof filters?.last_n_days === 'number' ? filters.last_n_days : 30,
    includePractice: filters?.include_practice === true,
  };
};

const parseRecipients = (input: string): string[] => {
  return input
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
};

const computePreviewDate = (
  scheduleType: ScheduleType,
  options: { weeklyDay: number; monthlyDay: number; hour: number; minute: number },
): string => {
  const now = new Date();

  if (scheduleType === 'after_match') {
    return 'After the next completed match.';
  }

  if (scheduleType === 'weekly') {
    const next = new Date(now);
    const delta = (options.weeklyDay - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
    next.setHours(options.hour, options.minute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 7);
    }
    return next.toLocaleString();
  }

  if (scheduleType === 'monthly') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const currentMonthDay = Math.min(options.monthlyDay, lastDay);
    const candidate = new Date(year, month, currentMonthDay, options.hour, options.minute, 0, 0);

    if (candidate > now) {
      return candidate.toLocaleString();
    }

    const nextMonth = new Date(year, month + 1, 1);
    const nextLastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(options.monthlyDay, nextLastDay);
    const nextCandidate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay, options.hour, options.minute, 0, 0);
    return nextCandidate.toLocaleString();
  }

  const seasonEnd = new Date(now.getFullYear(), 11, 31, options.hour, options.minute, 0, 0);
  if (seasonEnd <= now) {
    seasonEnd.setFullYear(seasonEnd.getFullYear() + 1);
  }
  return seasonEnd.toLocaleString();
};

const ScheduleConfigForm: React.FC<ScheduleConfigFormProps> = ({
  templates,
  teams,
  initialSchedule,
  onSubmit,
  onCancel,
}) => {
  const initialOptions = getInitialScheduleOptions(initialSchedule);
  const initialFilters = getInitialFilterOptions(initialSchedule);

  const [name, setName] = useState(initialSchedule?.name || '');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(initialSchedule?.schedule_type || 'weekly');
  const [templateId, setTemplateId] = useState<number | ''>(initialSchedule?.template_id || templates[0]?.id || '');
  const [teamId, setTeamId] = useState<number | ''>(initialSchedule?.team_id || teams[0]?.id || '');
  const [weeklyDay, setWeeklyDay] = useState(initialOptions.weeklyDay);
  const [monthlyDay, setMonthlyDay] = useState(initialOptions.monthlyDay);
  const [hour, setHour] = useState(initialOptions.hour);
  const [minute, setMinute] = useState(initialOptions.minute);
  const [sendEmail, setSendEmail] = useState(initialSchedule?.send_email || false);
  const [emailRecipientsInput, setEmailRecipientsInput] = useState((initialSchedule?.email_recipients || []).join(', '));
  const [emailSubject, setEmailSubject] = useState(initialSchedule?.email_subject || '');
  const [emailBody, setEmailBody] = useState(initialSchedule?.email_body || '');
  const [gameStatus, setGameStatus] = useState<GameStatusFilter>(initialFilters.gameStatus);
  const [lastNDays, setLastNDays] = useState(initialFilters.lastNDays);
  const [includePractice, setIncludePractice] = useState(initialFilters.includePractice);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const recipients = useMemo(() => parseRecipients(emailRecipientsInput), [emailRecipientsInput]);
  const previewNextExecution = useMemo(
    () => computePreviewDate(scheduleType, { weeklyDay, monthlyDay, hour, minute }),
    [scheduleType, weeklyDay, monthlyDay, hour, minute],
  );

  const validate = (): boolean => {
    if (!name.trim()) {
      setError('Schedule name is required.');
      return false;
    }

    if (!templateId) {
      setError('Please select a template.');
      return false;
    }

    if (scheduleType === 'monthly' && (monthlyDay < 1 || monthlyDay > 31)) {
      setError('Day of month must be between 1 and 31.');
      return false;
    }

    if (sendEmail) {
      if (recipients.length === 0) {
        setError('Add at least one email recipient.');
        return false;
      }

      const invalid = recipients.find((email) => !emailPattern.test(email));
      if (invalid) {
        setError(`Invalid email recipient: ${invalid}`);
        return false;
      }
    }

    if (lastNDays < 1 || lastNDays > 365) {
      setError('Game filter "last N days" must be between 1 and 365.');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      const payload: ScheduledReportPayload = {
        name: name.trim(),
        template_id: Number(templateId),
        schedule_type: scheduleType,
        team_id: teamId ? Number(teamId) : null,
        send_email: sendEmail,
        email_recipients: recipients,
        email_subject: emailSubject.trim() || undefined,
        email_body: emailBody.trim() || undefined,
        game_filters: {
          schedule_options: {
            weeklyDay,
            monthlyDay,
            hour,
            minute,
          },
          filters: {
            game_status: gameStatus,
            last_n_days: lastNDays,
            include_practice: includePractice,
          },
        },
      };

      await onSubmit(payload, initialSchedule?.id);
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError('Failed to save schedule.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="scheduled-reports-form">
      {error && <p className="scheduled-reports-form__error">{error}</p>}

      <label className="scheduled-reports-form__field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
      </label>

      <fieldset className="scheduled-reports-form__fieldset" aria-label="Schedule Type">
        <legend>Schedule Type</legend>
        <div className="scheduled-reports-form__radio-grid">
          {(Object.keys(scheduleTypeLabel) as ScheduleType[]).map((type) => (
            <label key={type} className="scheduled-reports-form__radio-item">
              <input
                type="radio"
                name="schedule-type"
                checked={scheduleType === type}
                onChange={() => setScheduleType(type)}
              />
              <span>{scheduleTypeLabel[type]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="scheduled-reports-form__field">
        <span>Template</span>
        <select value={templateId} onChange={(event) => setTemplateId(Number(event.target.value) || '')} required>
          <option value="" disabled>Select template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
      </label>

      <label className="scheduled-reports-form__field">
        <span>Team Filter</span>
        <select value={teamId} onChange={(event) => setTeamId(Number(event.target.value) || '')}>
          <option value="">All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      </label>

      <fieldset className="scheduled-reports-form__fieldset" aria-label="Game Filters">
        <legend>Game Filters</legend>
        <div className="scheduled-reports-form__inline-fields">
          <label className="scheduled-reports-form__field">
            <span>Game Status</span>
            <select value={gameStatus} onChange={(event) => setGameStatus(event.target.value as GameStatusFilter)}>
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          <label className="scheduled-reports-form__field">
            <span>Last N Days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={lastNDays}
              onChange={(event) => setLastNDays(Number(event.target.value))}
            />
          </label>
        </div>

        <label className="scheduled-reports-form__checkbox">
          <input
            type="checkbox"
            checked={includePractice}
            onChange={(event) => setIncludePractice(event.target.checked)}
          />
          <span>Include practice matches</span>
        </label>
      </fieldset>

      {scheduleType === 'weekly' && (
        <label className="scheduled-reports-form__field">
          <span>Weekday</span>
          <select value={weeklyDay} onChange={(event) => setWeeklyDay(Number(event.target.value))}>
            {weekdays.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </label>
      )}

      {scheduleType === 'monthly' && (
        <label className="scheduled-reports-form__field">
          <span>Day of Month</span>
          <input
            type="number"
            min={1}
            max={31}
            value={monthlyDay}
            onChange={(event) => setMonthlyDay(Number(event.target.value))}
          />
        </label>
      )}

      {scheduleType !== 'after_match' && (
        <TimeSchedulePicker
          hour={hour}
          minute={minute}
          onChange={(next) => {
            setHour(next.hour);
            setMinute(next.minute);
          }}
          label="Execution Time (daily schedules)"
        />
      )}

      <div className="scheduled-reports-form__preview" role="status" aria-live="polite">
        <strong>Next Execution Preview:</strong> {previewNextExecution}
      </div>

      <label className="scheduled-reports-form__checkbox">
        <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
        <span>Send report by email</span>
      </label>

      {sendEmail && (
        <>
          <label className="scheduled-reports-form__field">
            <span>Email Recipients (comma-separated)</span>
            <input
              placeholder="coach@example.com, analyst@example.com"
              value={emailRecipientsInput}
              onChange={(event) => setEmailRecipientsInput(event.target.value)}
            />
          </label>

          <label className="scheduled-reports-form__field">
            <span>Email Subject</span>
            <input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} maxLength={200} />
          </label>

          <label className="scheduled-reports-form__field">
            <span>Email Body</span>
            <textarea value={emailBody} onChange={(event) => setEmailBody(event.target.value)} rows={4} maxLength={2000} />
          </label>
        </>
      )}

      <div className="scheduled-reports-modal__actions">
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</button>
      </div>
    </form>
  );
};

export default ScheduleConfigForm;
