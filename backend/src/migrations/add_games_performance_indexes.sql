-- Performance indexes for games table
-- Addresses slow /api/games queries (avg 1073ms, p95 3046ms measured via UX observability)
-- The games list query filters on status, club_id, team_id, and always sorts by date DESC.
-- Previously only competition_id and season_id were indexed; date, status, and FK join columns were not.

-- Sort order index — covers the universal ORDER BY g.date DESC
CREATE INDEX IF NOT EXISTS idx_games_date
  ON games (date DESC);

-- Status filter index — covers WHERE g.status = $1 and the upcoming pseudo-status date range
CREATE INDEX IF NOT EXISTS idx_games_status
  ON games (status);

-- Club ID join/filter indexes — covers WHERE (home_club_id = $1 OR away_club_id = $1) and JOIN to clubs
CREATE INDEX IF NOT EXISTS idx_games_home_club_id
  ON games (home_club_id);

CREATE INDEX IF NOT EXISTS idx_games_away_club_id
  ON games (away_club_id);

-- Team ID join/filter indexes (partial — only rows where the column is set)
-- Covers WHERE (home_team_id = $1 OR away_team_id = $1) and LEFT JOIN to teams
CREATE INDEX IF NOT EXISTS idx_games_home_team_id
  ON games (home_team_id)
  WHERE home_team_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_away_team_id
  ON games (away_team_id)
  WHERE away_team_id IS NOT NULL;

-- Composite index for the most common access pattern: filter by status then sort by date
-- Used by dashboard widgets (status='upcoming' ORDER BY date ASC) and game list (status=X ORDER BY date DESC)
CREATE INDEX IF NOT EXISTS idx_games_status_date
  ON games (status, date DESC);
