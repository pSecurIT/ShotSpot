import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

const ALLOWED_EVENT_TYPES = new Set(['flow_timing', 'api_latency', 'long_task', 'slow_render', 'feedback']);
const MAX_BATCH_SIZE = 50;
const MAX_TEXT_LENGTH = 255;
const MAX_PATH_LENGTH = 512;

router.use(auth);

const normalizeText = (value, { maxLength = MAX_TEXT_LENGTH, required = false } = {}) => {
  if (typeof value !== 'string') {
    if (required) return null;
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return required ? null : null;
  }

  return trimmed.slice(0, maxLength);
};

const normalizeEvent = (rawEvent, index) => {
  if (!rawEvent || typeof rawEvent !== 'object' || Array.isArray(rawEvent)) {
    return { error: `events[${index}] must be an object` };
  }

  const routePath = normalizeText(rawEvent.routePath, { maxLength: MAX_PATH_LENGTH, required: true });
  if (!routePath) {
    return { error: `events[${index}].routePath is required` };
  }

  const flowName = normalizeText(rawEvent.flowName, { required: true });
  if (!flowName) {
    return { error: `events[${index}].flowName is required` };
  }

  const eventType = normalizeText(rawEvent.eventType, { required: true });
  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return { error: `events[${index}].eventType must be one of: ${Array.from(ALLOWED_EVENT_TYPES).join(', ')}` };
  }

  const metricName = normalizeText(rawEvent.metricName, { required: eventType !== 'feedback' }) || (eventType === 'feedback' ? 'smoothness_rating' : null);
  if (!metricName) {
    return { error: `events[${index}].metricName is required` };
  }

  const valueMs = typeof rawEvent.valueMs === 'undefined' || rawEvent.valueMs === null
    ? null
    : Number(rawEvent.valueMs);

  if (valueMs !== null && (!Number.isFinite(valueMs) || valueMs < 0)) {
    return { error: `events[${index}].valueMs must be a non-negative number when provided` };
  }

  const rating = typeof rawEvent.rating === 'undefined' || rawEvent.rating === null
    ? null
    : Number(rawEvent.rating);

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: `events[${index}].rating must be an integer between 1 and 5 when provided` };
  }

  if (eventType === 'feedback' && rating === null) {
    return { error: `events[${index}].rating is required for feedback events` };
  }

  const endpoint = normalizeText(rawEvent.endpoint, { maxLength: MAX_PATH_LENGTH, required: false });
  const sessionId = normalizeText(rawEvent.sessionId, { maxLength: MAX_TEXT_LENGTH, required: false });

  let metadata = {};
  if (typeof rawEvent.metadata !== 'undefined') {
    if (!rawEvent.metadata || typeof rawEvent.metadata !== 'object' || Array.isArray(rawEvent.metadata)) {
      return { error: `events[${index}].metadata must be an object when provided` };
    }
    metadata = rawEvent.metadata;
  }

  let createdAt = null;
  if (rawEvent.timestamp) {
    const parsed = new Date(rawEvent.timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return { error: `events[${index}].timestamp must be a valid ISO date when provided` };
    }
    createdAt = parsed.toISOString();
  }

  return {
    routePath,
    flowName,
    eventType,
    metricName,
    valueMs: valueMs === null ? null : Math.round(valueMs),
    rating,
    endpoint,
    sessionId,
    metadata,
    createdAt,
  };
};

router.post('/events', async (req, res) => {
  try {
    const body = req.body || {};
    const rawEvents = Array.isArray(body.events) ? body.events : [body];

    if (rawEvents.length === 0) {
      return res.status(400).json({ error: 'At least one event is required' });
    }

    if (rawEvents.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ error: `Batch size exceeds ${MAX_BATCH_SIZE} events` });
    }

    const normalizedEvents = [];
    for (let index = 0; index < rawEvents.length; index += 1) {
      const normalized = normalizeEvent(rawEvents[index], index);
      if (normalized.error) {
        return res.status(400).json({ error: normalized.error });
      }
      normalizedEvents.push(normalized);
    }

    const userId = req.user?.userId || req.user?.id || null;

    for (const event of normalizedEvents) {
      await db.query(
        `INSERT INTO ux_metric_events (
          user_id, session_id, route_path, flow_name, event_type, metric_name,
          value_ms, rating, endpoint, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, CURRENT_TIMESTAMP))`,
        [
          userId,
          event.sessionId,
          event.routePath,
          event.flowName,
          event.eventType,
          event.metricName,
          event.valueMs,
          event.rating,
          event.endpoint,
          JSON.stringify(event.metadata),
          event.createdAt,
        ]
      );
    }

    return res.status(201).json({
      inserted: normalizedEvents.length,
    });
  } catch (err) {
    logError('Error ingesting UX observability events:', err);
    return res.status(500).json({ error: 'Failed to ingest UX observability events' });
  }
});

export default router;