CREATE TABLE IF NOT EXISTS ux_metric_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT,
  route_path TEXT NOT NULL,
  flow_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value_ms INTEGER,
  rating INTEGER,
  endpoint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ux_metric_events_event_type_check CHECK (
    event_type IN ('flow_timing', 'api_latency', 'long_task', 'slow_render', 'feedback')
  ),
  CONSTRAINT ux_metric_events_metric_name_check CHECK (char_length(metric_name) > 0),
  CONSTRAINT ux_metric_events_flow_name_check CHECK (char_length(flow_name) > 0),
  CONSTRAINT ux_metric_events_route_path_check CHECK (char_length(route_path) > 0),
  CONSTRAINT ux_metric_events_value_ms_check CHECK (value_ms IS NULL OR value_ms >= 0),
  CONSTRAINT ux_metric_events_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_ux_metric_events_created_at
  ON ux_metric_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ux_metric_events_type_flow_created
  ON ux_metric_events (event_type, flow_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ux_metric_events_route_created
  ON ux_metric_events (route_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ux_metric_events_endpoint_created
  ON ux_metric_events (endpoint, created_at DESC)
  WHERE endpoint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ux_metric_events_feedback_created
  ON ux_metric_events (created_at DESC)
  WHERE event_type = 'feedback';