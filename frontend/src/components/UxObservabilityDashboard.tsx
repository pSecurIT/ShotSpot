import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import PageLayout from './ui/PageLayout';
import StatePanel from './ui/StatePanel';
import useBreadcrumbs from '../hooks/useBreadcrumbs';

/** Compute absolute from/to ISO strings for a preset like '1h', '6h', '3d', '7d'. */
function presetToRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const ms = preset.endsWith('h')
    ? parseInt(preset, 10) * 3_600_000
    : parseInt(preset, 10) * 86_400_000;
  return { from: new Date(now.getTime() - ms).toISOString(), to: now.toISOString() };
}

/** Convert an ISO UTC string to a datetime-local input value (local time). */
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface OverviewPayload {
  total_events: number;
  long_task_count: number;
  slow_render_count: number;
  avg_flow_ms: number;
  p95_flow_ms: number;
  avg_api_latency_ms: number;
  p95_api_latency_ms: number;
}

interface FlowRow {
  flow_name: string;
  route_path: string;
  sample_count: number;
  avg_ms: number;
  p95_ms: number;
  max_ms: number;
}

interface LatencyRow {
  endpoint: string;
  sample_count: number;
  avg_ms: number;
  p95_ms: number;
  max_ms: number;
}

interface FrictionRow {
  event_type: string;
  sample_count: number;
  avg_ms: number;
  p95_ms: number;
  max_ms: number;
}

const UxObservabilityDashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const breadcrumbs = useBreadcrumbs();

  // --- filter state ---
  const [filterMode, setFilterMode] = useState<'preset' | 'custom'>('preset');
  const [preset, setPreset] = useState('7d');
  // Applied range that actually drives data loading
  const [activeFrom, setActiveFrom] = useState(() => presetToRange('7d').from);
  const [activeTo, setActiveTo]     = useState(() => presetToRange('7d').to);
  // Custom form inputs (not applied until Apply is clicked)
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [latency, setLatency] = useState<LatencyRow[]>([]);
  const [friction, setFriction] = useState<FrictionRow[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const timeParams = { from: activeFrom, to: activeTo };
      const [overviewRes, flowsRes, latencyRes, frictionRes] = await Promise.all([
        api.get('/dashboard/ux/overview', { params: timeParams }),
        api.get('/dashboard/ux/flows', { params: timeParams }),
        api.get('/dashboard/ux/api-latency', { params: timeParams }),
        api.get('/dashboard/ux/friction', { params: timeParams }),
      ]);

      setOverview(overviewRes.data.overview);
      setFlows(flowsRes.data.flows || []);
      setLatency(latencyRes.data.latency || []);
      setFriction(frictionRes.data.indicators || []);
    } catch (err) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Failed to load UX observability data');
    } finally {
      setLoading(false);
    }
  }, [activeFrom, activeTo]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    void loadData();
  }, [isAdmin, loadData]);

  if (!isAdmin) {
    return <div>You do not have permission to access this page.</div>;
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
      setFilterMode('custom');
      setCustomFrom(toLocalDateTimeInput(activeFrom));
      setCustomTo(toLocalDateTimeInput(activeTo));
      setCustomError(null);
    } else {
      setFilterMode('preset');
      setPreset(value);
      const { from, to } = presetToRange(value);
      setActiveFrom(from);
      setActiveTo(to);
    }
  };

  const handleApplyCustom = () => {
    if (!customFrom || !customTo) {
      setCustomError('Both from and to are required');
      return;
    }
    const from = new Date(customFrom);
    const to   = new Date(customTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      setCustomError('Invalid date/time');
      return;
    }
    if (from >= to) {
      setCustomError('"From" must be before "To"');
      return;
    }
    setCustomError(null);
    setActiveFrom(from.toISOString());
    setActiveTo(to.toISOString());
  };

  return (
    <PageLayout
      title="UX Observability"
      eyebrow="Analytics > UX Observability"
      description="Track flow speed, latency impact, and friction indicators."
      breadcrumbs={breadcrumbs}
      actions={(
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            aria-label="Time window"
            value={filterMode === 'custom' ? 'custom' : preset}
            onChange={handleSelectChange}
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="12h">Last 12 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="3d">Last 3 days</option>
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range…</option>
          </select>
          {filterMode === 'custom' && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                From
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="Custom range from"
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                To
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="Custom range to"
                />
              </label>
              <button type="button" className="primary-button" onClick={handleApplyCustom}>
                Apply
              </button>
              {customError && (
                <span role="alert" style={{ color: 'var(--color-error, red)', fontSize: '0.8rem' }}>
                  {customError}
                </span>
              )}
            </>
          )}
          <button type="button" className="secondary-button" onClick={() => void loadData()}>
            Refresh
          </button>
        </div>
      )}
    >
      {loading && <StatePanel variant="loading" title="Loading UX metrics" />}
      {error && <StatePanel variant="error" title="Unable to load UX metrics" message={error} />}

      {!loading && !error && overview && (
        <>
          <section aria-label="UX overview" style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <article className="dashboard-widget"><h3>Total Events</h3><p>{overview.total_events}</p></article>
            <article className="dashboard-widget"><h3>P95 Flow Time</h3><p>{overview.p95_flow_ms} ms</p></article>
            <article className="dashboard-widget"><h3>P95 API Latency</h3><p>{overview.p95_api_latency_ms} ms</p></article>
            <article className="dashboard-widget"><h3>Long Tasks</h3><p>{overview.long_task_count}</p></article>
            <article className="dashboard-widget"><h3>Slow Renders</h3><p>{overview.slow_render_count}</p></article>
          </section>

          <section style={{ marginTop: '1.25rem' }} aria-label="Flow timing table">
            <h3>Slowest Tracked Flows</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Flow</th>
                  <th align="left">Route</th>
                  <th align="right">Samples</th>
                  <th align="right">Avg (ms)</th>
                  <th align="right">P95 (ms)</th>
                </tr>
              </thead>
              <tbody>
                {flows.slice(0, 8).map((row) => (
                  <tr key={`${row.flow_name}-${row.route_path}`}>
                    <td>{row.flow_name}</td>
                    <td>{row.route_path}</td>
                    <td align="right">{row.sample_count}</td>
                    <td align="right">{row.avg_ms}</td>
                    <td align="right">{row.p95_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginTop: '1.25rem' }} aria-label="API latency table">
            <h3>API Latency Impact</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left">Endpoint</th>
                  <th align="right">Samples</th>
                  <th align="right">Avg (ms)</th>
                  <th align="right">P95 (ms)</th>
                </tr>
              </thead>
              <tbody>
                {latency.slice(0, 8).map((row) => (
                  <tr key={row.endpoint}>
                    <td>{row.endpoint}</td>
                    <td align="right">{row.sample_count}</td>
                    <td align="right">{row.avg_ms}</td>
                    <td align="right">{row.p95_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginTop: '1.25rem' }} aria-label="Friction signals">
            <h3>Client Friction Signals</h3>
            {friction.length === 0 ? (
              <StatePanel variant="empty" title="No friction signals yet" message="Long tasks and slow renders will appear here." />
            ) : (
              <ul>
                {friction.map((row) => (
                  <li key={row.event_type}>
                    {row.event_type}: {row.sample_count} events, avg {row.avg_ms} ms, p95 {row.p95_ms} ms
                  </li>
                ))}
              </ul>
            )}
          </section>

        </>
      )}
    </PageLayout>
  );
};

export default UxObservabilityDashboard;