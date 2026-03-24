import React, { useEffect, useMemo, useState } from 'react';
import type {
  ReportTemplateOption,
  ScheduleType,
  ScheduledReport,
  ScheduledReportPayload,
  TeamOption,
} from '../types/scheduled-reports';

interface ReportScheduleDialogProps {
  isOpen: boolean;
  templates: ReportTemplateOption[];
  teams: TeamOption[];
  initialSchedule?: ScheduledReport | null;
  onClose: () => void;
  onSave: (payload: ScheduledReportPayload, id?: number) => Promise<void>;
}

const DEFAULT_WEEKLY_DAY = 1;
const DEFAULT_MONTHLY_DAY = 1;
const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

const scheduleTypeLabel: Record<ScheduleType, string> = {
  after_match: 'After Match',
  weekly: 'Weekly',
  monthly: 'Monthly',
  season_end: 'Season End',
};

const weekdays = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const minutes = Array.from({ length: 60 }, (_, minute) => minute);

const parseEmailList = (raw: string): string[] => {
  return raw
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
};

const ReportScheduleDialog: React.FC<ReportScheduleDialogProps> = ({
  isOpen,
  templates,
  teams,
  initialSchedule,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('weekly');
  const [teamId, setTeamId] = useState<number | ''>('');
  const [sendEmail, setSendEmail] = useState(false);
  const [emailRecipientsInput, setEmailRecipientsInput] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [weeklyDay, setWeeklyDay] = useState(DEFAULT_WEEKLY_DAY);
  const [monthlyDay, setMonthlyDay] = useState(DEFAULT_MONTHLY_DAY);
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [minute, setMinute] = useState(DEFAULT_MINUTE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const title = initialSchedule ? 'Edit Scheduled Report' : 'Create Scheduled Report';

  const recipients = useMemo(() => parseEmailList(emailRecipientsInput), [emailRecipientsInput]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialSchedule) {
      const scheduleOptions = initialSchedule.game_filters?.schedule_options;
      const weeklyDayValue = typeof scheduleOptions?.weeklyDay === 'number' ? scheduleOptions.weeklyDay : DEFAULT_WEEKLY_DAY;
      const monthlyDayValue = typeof scheduleOptions?.monthlyDay === 'number' ? scheduleOptions.monthlyDay : DEFAULT_MONTHLY_DAY;
      const hourValue = typeof scheduleOptions?.hour === 'number' ? scheduleOptions.hour : DEFAULT_HOUR;
      const minuteValue = typeof scheduleOptions?.minute === 'number' ? scheduleOptions.minute : DEFAULT_MINUTE;

      setName(initialSchedule.name);
      setTemplateId(initialSchedule.template_id);
      setScheduleType(initialSchedule.schedule_type);
      setTeamId(initialSchedule.team_id ?? '');
      setSendEmail(initialSchedule.send_email);
      setEmailRecipientsInput((initialSchedule.email_recipients || []).join(', '));
      setEmailSubject(initialSchedule.email_subject || '');
      setEmailBody(initialSchedule.email_body || '');
      setWeeklyDay(weeklyDayValue);
      setMonthlyDay(monthlyDayValue);
      setHour(hourValue);
      setMinute(minuteValue);
    } else {
      setName('');
      setTemplateId(templates[0]?.id ?? '');
      setScheduleType('weekly');
      setTeamId(teams[0]?.id ?? '');
      setSendEmail(false);
      setEmailRecipientsInput('');
      setEmailSubject('');
      setEmailBody('');
      setWeeklyDay(DEFAULT_WEEKLY_DAY);
      setMonthlyDay(DEFAULT_MONTHLY_DAY);
      setHour(DEFAULT_HOUR);
      setMinute(DEFAULT_MINUTE);
    }

    setError('');
  }, [initialSchedule, isOpen, teams, templates]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!templateId) {
      setError('Template is required');
      return;
    }

    if (sendEmail && recipients.length === 0) {
      setError('Add at least one email recipient when email delivery is enabled');
      return;
    }

    setError('');
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
        },
      };

      await onSave(payload, initialSchedule?.id);
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save scheduled report');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scheduled-reports-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scheduled-reports-modal">
        <div className="scheduled-reports-modal__header">
          <h3>{title}</h3>
          <button
            type="button"
            className="scheduled-reports-modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="scheduled-reports-form">
          {error && <p className="scheduled-reports-form__error">{error}</p>}

          <label className="scheduled-reports-form__field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
            />
          </label>

          <label className="scheduled-reports-form__field">
            <span>Template</span>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(Number(event.target.value) || '')}
              required
            >
              <option value="" disabled>Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <label className="scheduled-reports-form__field">
            <span>Schedule Type</span>
            <select
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value as ScheduleType)}
            >
              {(Object.keys(scheduleTypeLabel) as ScheduleType[]).map((type) => (
                <option key={type} value={type}>{scheduleTypeLabel[type]}</option>
              ))}
            </select>
          </label>

          <label className="scheduled-reports-form__field">
            <span>Team (Optional)</span>
            <select
              value={teamId}
              onChange={(event) => setTeamId(Number(event.target.value) || '')}
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>

          <fieldset className="scheduled-reports-form__fieldset">
            <legend>Cron-like options</legend>

            {scheduleType === 'weekly' && (
              <label className="scheduled-reports-form__field">
                <span>Day of Week</span>
                <select
                  value={weeklyDay}
                  onChange={(event) => setWeeklyDay(Number(event.target.value))}
                >
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
              <div className="scheduled-reports-form__inline-fields">
                <label className="scheduled-reports-form__field">
                  <span>Hour</span>
                  <select value={hour} onChange={(event) => setHour(Number(event.target.value))}>
                    {hours.map((h) => (
                      <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </label>

                <label className="scheduled-reports-form__field">
                  <span>Minute</span>
                  <select value={minute} onChange={(event) => setMinute(Number(event.target.value))}>
                    {minutes.map((m) => (
                      <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </fieldset>

          <label className="scheduled-reports-form__checkbox">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(event) => setSendEmail(event.target.checked)}
            />
            <span>Send report by email</span>
          </label>

          {sendEmail && (
            <>
              <label className="scheduled-reports-form__field">
                <span>Email Recipients</span>
                <input
                  placeholder="coach@example.com, analyst@example.com"
                  value={emailRecipientsInput}
                  onChange={(event) => setEmailRecipientsInput(event.target.value)}
                />
                <small>Use comma-separated email addresses.</small>
              </label>

              <label className="scheduled-reports-form__field">
                <span>Email Subject</span>
                <input
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  maxLength={200}
                />
              </label>

              <label className="scheduled-reports-form__field">
                <span>Email Body</span>
                <textarea
                  value={emailBody}
                  onChange={(event) => setEmailBody(event.target.value)}
                  rows={4}
                  maxLength={2000}
                />
              </label>
            </>
          )}

          <div className="scheduled-reports-modal__actions">
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportScheduleDialog;
