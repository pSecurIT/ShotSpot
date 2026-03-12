-- Seed Default Match Templates
-- This migration adds default match templates that are available to all users

-- Standard League Match Template
INSERT INTO match_templates (
    name,
    description,
    number_of_periods,
    period_duration_minutes,
    competition_type,
    is_system_template,
    allow_same_team,
    created_by
)
SELECT
    'Standard League Match',
    'Standard korfball league match with 4 periods of 10 minutes',
    4,
    10,
    'league',
    true,
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM match_templates WHERE name = 'Standard League Match' AND is_system_template = true
);

-- Cup Match Template
INSERT INTO match_templates (
    name,
    description,
    number_of_periods,
    period_duration_minutes,
    competition_type,
    is_system_template,
    allow_same_team,
    created_by
)
SELECT
    'Cup Match',
    'Cup match with 4 periods of 10 minutes',
    4,
    10,
    'cup',
    true,
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM match_templates WHERE name = 'Cup Match' AND is_system_template = true
);

-- Practice Match Template (Allows same team)
INSERT INTO match_templates (
    name,
    description,
    number_of_periods,
    period_duration_minutes,
    competition_type,
    is_system_template,
    allow_same_team,
    created_by
)
SELECT
    'Practice Match',
    'Practice or training match - teams can play against themselves',
    2,
    15,
    'friendly',
    true,
    true,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM match_templates WHERE name = 'Practice Match' AND is_system_template = true
);

-- Tournament Match Template
INSERT INTO match_templates (
    name,
    description,
    number_of_periods,
    period_duration_minutes,
    competition_type,
    is_system_template,
    allow_same_team,
    created_by
)
SELECT
    'Tournament Match',
    'Tournament match with shorter periods',
    4,
    8,
    'tournament',
    true,
    false,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM match_templates WHERE name = 'Tournament Match' AND is_system_template = true
);
