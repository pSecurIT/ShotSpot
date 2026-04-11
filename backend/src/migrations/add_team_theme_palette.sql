ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS club_theme_palette_id character varying(50) NOT NULL DEFAULT 'shotspot-blue';

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS team_theme_palette_id character varying(50);

ALTER TABLE teams
ALTER COLUMN team_theme_palette_id DROP NOT NULL;

ALTER TABLE teams
ALTER COLUMN team_theme_palette_id DROP DEFAULT;

COMMENT ON COLUMN clubs.club_theme_palette_id IS 'Default club theme palette identifier used as the baseline for teams and players';

COMMENT ON COLUMN teams.team_theme_palette_id IS 'Optional team theme palette override. NULL means the team inherits the club theme';