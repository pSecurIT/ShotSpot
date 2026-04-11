-- Add stable client identity and confirmation status for offline-first event workflows.

ALTER TABLE public.shots
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.game_events
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.free_shots
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.timeouts
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.substitutions
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.ball_possessions
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shots_event_status_check'
  ) THEN
    ALTER TABLE public.shots
      ADD CONSTRAINT shots_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_events_event_status_check'
  ) THEN
    ALTER TABLE public.game_events
      ADD CONSTRAINT game_events_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'free_shots_event_status_check'
  ) THEN
    ALTER TABLE public.free_shots
      ADD CONSTRAINT free_shots_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeouts_event_status_check'
  ) THEN
    ALTER TABLE public.timeouts
      ADD CONSTRAINT timeouts_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'substitutions_event_status_check'
  ) THEN
    ALTER TABLE public.substitutions
      ADD CONSTRAINT substitutions_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ball_possessions_event_status_check'
  ) THEN
    ALTER TABLE public.ball_possessions
      ADD CONSTRAINT ball_possessions_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS shots_game_client_uuid_unique
  ON public.shots (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS game_events_game_client_uuid_unique
  ON public.game_events (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS free_shots_game_client_uuid_unique
  ON public.free_shots (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS timeouts_game_client_uuid_unique
  ON public.timeouts (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS substitutions_game_client_uuid_unique
  ON public.substitutions (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ball_possessions_game_client_uuid_unique
  ON public.ball_possessions (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;
