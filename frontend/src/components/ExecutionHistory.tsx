import React, { useEffect, useState } from 'react';
import { scheduledReportsApi } from '../services/scheduledReportsApi';
import type { ScheduledReportHistoryEntry } from '../types/scheduled-reports';

interface ExecutionHistoryProps {
  scheduleId: number;
}

const formatDateTime = (value: string) => {
  return new Date(value).toLocaleString();
};

const ExecutionHistory: React.FC<ExecutionHistoryProps> = ({ scheduleId }) => {
  const [history, setHistory] = useState<ScheduledReportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await scheduledReportsApi.getHistory(scheduleId, 20);
        if (active) {
          setHistory(response.history);
        }
      } catch (err) {
        if (!active) {
          return;
        }

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to load execution history');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [scheduleId]);

  if (loading) {
    return <div className="scheduled-reports-history">Loading history...</div>;
  }

  if (error) {
    return <div className="scheduled-reports-history scheduled-reports-history--error">{error}</div>;
  }

  if (history.length === 0) {
    return <div className="scheduled-reports-history">No executions yet.</div>;
  }

  return (
    <div className="scheduled-reports-history" aria-live="polite">
      <table>
        <thead>
          <tr>
            <th>Run At</th>
            <th>Report</th>
            <th>Status</th>
            <th>Type</th>
            <th>Format</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDateTime(entry.created_at)}</td>
              <td>{entry.report_name}</td>
              <td>
                <span className={`scheduled-reports-history__status scheduled-reports-history__status--${entry.status}`}>
                  {entry.status}
                </span>
              </td>
              <td>{entry.report_type}</td>
              <td>{entry.format.toUpperCase()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExecutionHistory;
