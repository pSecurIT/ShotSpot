-- Trainer assignments map coaches to clubs/teams with active windows
CREATE TABLE IF NOT EXISTS trainer_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trainer_assignments_active_dates CHECK (active_to IS NULL OR active_to >= active_from)
);

-- Ensure only one active assignment per user/club/team at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_trainer_assignment_active
  ON trainer_assignments (user_id, club_id, COALESCE(team_id, -1))
  WHERE is_active = true AND active_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_trainer_assignments_user ON trainer_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_club ON trainer_assignments(club_id);
CREATE INDEX IF NOT EXISTS idx_trainer_assignments_team ON trainer_assignments(team_id);

-- Updated-at trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_trainer_assignments_updated_at'
    ) THEN
        CREATE TRIGGER update_trainer_assignments_updated_at
            BEFORE UPDATE ON trainer_assignments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
