ALTER TABLE public.match_commentary
  ADD COLUMN IF NOT EXISTS client_uuid UUID,
  ADD COLUMN IF NOT EXISTS event_status VARCHAR(20) NOT NULL DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'match_commentary_event_status_check'
  ) THEN
    ALTER TABLE public.match_commentary
      ADD CONSTRAINT match_commentary_event_status_check
      CHECK (event_status IN ('confirmed', 'unconfirmed'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS match_commentary_game_client_uuid_unique
  ON public.match_commentary (game_id, client_uuid)
  WHERE client_uuid IS NOT NULL;