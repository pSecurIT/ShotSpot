-- Add home_attacking_side field to games table
-- This indicates which side (left or right) the home team attacks throughout the match
-- 'left' means home team attacks the left korf (at 13% x-coordinate)
-- 'right' means home team attacks the right korf (at 87% x-coordinate)
-- Note: In korfball, the attacking/defending PLAYERS within each team switch sides every 2 goals,
-- but the TEAMS' attacking korfs remain constant throughout the match

ALTER TABLE games
ADD COLUMN IF NOT EXISTS home_attacking_side VARCHAR(10) CHECK (home_attacking_side IN ('left', 'right'));

-- Add comment to explain the field
COMMENT ON COLUMN games.home_attacking_side IS 
'Indicates which korf the home team attacks throughout the match. Left = 13% x-coord, Right = 87% x-coord. Within each team, attacking and defending players switch sides every 2 goals, but teams always attack the same korf.';
