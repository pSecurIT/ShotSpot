-- Practice match support
-- Adds template support for same-team matches and relaxes the games club
-- constraint for team-level practice matches.

ALTER TABLE match_templates
ADD COLUMN IF NOT EXISTS allow_same_team BOOLEAN DEFAULT false;

COMMENT ON COLUMN match_templates.allow_same_team IS 'Allow teams to play against themselves in practice matches';

ALTER TABLE games DROP CONSTRAINT IF EXISTS games_home_club_id_away_club_id_check;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_home_club_id_check;

ALTER TABLE games ADD CONSTRAINT games_home_club_id_away_club_id_check
  CHECK ((home_club_id <> away_club_id) OR (home_team_id IS NOT NULL AND away_team_id IS NOT NULL));