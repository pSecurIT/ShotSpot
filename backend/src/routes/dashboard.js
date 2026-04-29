import express from 'express';
import db from '../db.js';
import { auth, requireRole } from '../middleware/auth.js';

import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

const resolveWindowDays = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 7;
  }
  return Math.min(parsed, 90);
};

/**
 * Resolve an absolute [from, to] time range from query params.
 * Priority:
 *   1. ?from=ISO&to=ISO  — custom absolute range (capped at 90 days)
 *   2. ?hours=N          — last N hours (max 2160 = 90 days)
 *   3. ?days=N           — last N days (legacy / default)
 */
const resolveTimeRange = (query) => {
  const now = new Date();

  if (query.from && query.to) {
    const fromDate = new Date(query.from);
    const toDate   = new Date(query.to);
    if (
      !isNaN(fromDate.getTime()) &&
      !isNaN(toDate.getTime()) &&
      fromDate < toDate
    ) {
      const diffMs = toDate.getTime() - fromDate.getTime();
      if (diffMs <= 90 * 24 * 3600 * 1000) {
        return { from: fromDate.toISOString(), to: toDate.toISOString() };
      }
    }
  }

  if (query.hours) {
    const h = Number.parseInt(String(query.hours), 10);
    if (Number.isFinite(h) && h > 0 && h <= 2160) {
      return {
        from: new Date(now.getTime() - h * 3_600_000).toISOString(),
        to: now.toISOString(),
      };
    }
  }

  const windowDays = resolveWindowDays(query.days);
  return {
    from: new Date(now.getTime() - windowDays * 86_400_000).toISOString(),
    to: now.toISOString(),
  };
};

/**
 * GET /api/dashboard/summary
 * Quick stats summary for the dashboard landing page.
 */
router.get('/summary', async (_req, res) => {
  try {
    const [teamsResult, playersResult, gamesResult] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM teams'),
      db.query('SELECT COUNT(*)::int AS count FROM players'),
      db.query('SELECT COUNT(*)::int AS count FROM games')
    ]);

    res.json({
      teams: teamsResult.rows[0]?.count ?? 0,
      players: playersResult.rows[0]?.count ?? 0,
      games: gamesResult.rows[0]?.count ?? 0
    });
  } catch (err) {
    logError('Error fetching dashboard summary:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

router.get('/ux/overview', requireRole(['admin']), async (req, res) => {
  try {
    const { from, to } = resolveTimeRange(req.query);

    const result = await db.query(
      `SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (WHERE event_type = 'feedback')::int AS feedback_count,
        COUNT(*) FILTER (WHERE event_type = 'feedback' AND rating <= 2)::int AS negative_feedback_count,
        COUNT(*) FILTER (WHERE event_type = 'long_task')::int AS long_task_count,
        COUNT(*) FILTER (WHERE event_type = 'slow_render')::int AS slow_render_count,
        ROUND((AVG(value_ms) FILTER (WHERE event_type = 'flow_timing' AND value_ms IS NOT NULL))::numeric, 2) AS avg_flow_ms,
        ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms) FILTER (WHERE event_type = 'flow_timing' AND value_ms IS NOT NULL))::numeric, 2) AS p95_flow_ms,
        ROUND((AVG(value_ms) FILTER (WHERE event_type = 'api_latency' AND value_ms IS NOT NULL))::numeric, 2) AS avg_api_latency_ms,
        ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms) FILTER (WHERE event_type = 'api_latency' AND value_ms IS NOT NULL))::numeric, 2) AS p95_api_latency_ms
      FROM ux_metric_events
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
      [from, to]
    );

    const row = result.rows[0] || {};

    return res.json({
      from,
      to,
      overview: {
        total_events: Number(row.total_events || 0),
        feedback_count: Number(row.feedback_count || 0),
        negative_feedback_count: Number(row.negative_feedback_count || 0),
        long_task_count: Number(row.long_task_count || 0),
        slow_render_count: Number(row.slow_render_count || 0),
        avg_flow_ms: Number(row.avg_flow_ms || 0),
        p95_flow_ms: Number(row.p95_flow_ms || 0),
        avg_api_latency_ms: Number(row.avg_api_latency_ms || 0),
        p95_api_latency_ms: Number(row.p95_api_latency_ms || 0),
      }
    });
  } catch (err) {
    logError('Error fetching UX overview metrics:', err);
    return res.status(500).json({ error: 'Failed to fetch UX overview metrics' });
  }
});

router.get('/ux/flows', requireRole(['admin']), async (req, res) => {
  try {
    const { from, to } = resolveTimeRange(req.query);

    const result = await db.query(
      `SELECT
        flow_name,
        route_path,
        metric_name,
        COUNT(*)::int AS sample_count,
        ROUND(AVG(value_ms)::numeric, 2) AS avg_ms,
        ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms))::numeric, 2) AS p95_ms,
        MAX(value_ms)::int AS max_ms
      FROM ux_metric_events
      WHERE event_type = 'flow_timing'
        AND value_ms IS NOT NULL
        AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
      GROUP BY flow_name, route_path, metric_name
      ORDER BY avg_ms DESC NULLS LAST, sample_count DESC
      LIMIT 30`,
      [from, to]
    );

    return res.json({
      from,
      to,
      flows: result.rows,
    });
  } catch (err) {
    logError('Error fetching UX flow metrics:', err);
    return res.status(500).json({ error: 'Failed to fetch UX flow metrics' });
  }
});

router.get('/ux/api-latency', requireRole(['admin']), async (req, res) => {
  try {
    const { from, to } = resolveTimeRange(req.query);

    const result = await db.query(
      `SELECT
        COALESCE(NULLIF(endpoint, ''), 'unknown') AS endpoint,
        COUNT(*)::int AS sample_count,
        ROUND(AVG(value_ms)::numeric, 2) AS avg_ms,
        ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms))::numeric, 2) AS p95_ms,
        MAX(value_ms)::int AS max_ms
      FROM ux_metric_events
      WHERE event_type = 'api_latency'
        AND value_ms IS NOT NULL
        AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
      GROUP BY endpoint
      ORDER BY avg_ms DESC NULLS LAST, sample_count DESC
      LIMIT 30`,
      [from, to]
    );

    return res.json({
      from,
      to,
      latency: result.rows,
    });
  } catch (err) {
    logError('Error fetching UX API latency metrics:', err);
    return res.status(500).json({ error: 'Failed to fetch UX API latency metrics' });
  }
});

router.get('/ux/friction', requireRole(['admin']), async (req, res) => {
  try {
    const { from, to } = resolveTimeRange(req.query);

    const result = await db.query(
      `SELECT
        event_type,
        COUNT(*)::int AS sample_count,
        ROUND(AVG(value_ms)::numeric, 2) AS avg_ms,
        ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY value_ms))::numeric, 2) AS p95_ms,
        MAX(value_ms)::int AS max_ms
      FROM ux_metric_events
      WHERE event_type IN ('long_task', 'slow_render')
        AND value_ms IS NOT NULL
        AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
      GROUP BY event_type
      ORDER BY sample_count DESC`,
      [from, to]
    );

    return res.json({
      from,
      to,
      indicators: result.rows,
    });
  } catch (err) {
    logError('Error fetching UX friction indicators:', err);
    return res.status(500).json({ error: 'Failed to fetch UX friction indicators' });
  }
});

router.get('/ux/feedback', requireRole(['admin']), async (req, res) => {
  try {
    const windowDays = resolveWindowDays(req.query.days);

    const result = await db.query(
      `SELECT
        e.id,
        e.created_at,
        e.route_path,
        e.flow_name,
        e.metric_name,
        e.rating,
        e.metadata,
        COALESCE(u.username, 'unknown') AS username
      FROM ux_metric_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.event_type = 'feedback'
        AND e.created_at >= NOW() - ($1::text || ' days')::interval
      ORDER BY e.created_at DESC
      LIMIT 50`,
      [windowDays]
    );

    return res.json({
      window_days: windowDays,
      feedback: result.rows,
    });
  } catch (err) {
    logError('Error fetching UX feedback:', err);
    return res.status(500).json({ error: 'Failed to fetch UX feedback' });
  }
});

export default router;
