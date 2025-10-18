-- Add gender field to players table
-- Gender: 'male' or 'female'

ALTER TABLE players
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));

-- Add comment
COMMENT ON COLUMN players.gender IS 
'Player gender: male or female. Required for korfball team composition (4 males + 4 females per team).';
