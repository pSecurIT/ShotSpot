-- Seed default achievements
-- Note: Using plain ASCII characters to avoid encoding issues

INSERT INTO achievements (name, description, badge_icon, category, criteria, points) VALUES
-- Shooting achievements
('Sharpshooter', 'Score 10+ goals in a single game', 'target', 'shooting', '{"min_goals_per_game": 10}', 100),
('Perfect Shot', 'Achieve 100% shooting accuracy (min 5 shots)', '100', 'shooting', '{"min_fg_percentage": 100, "min_shots": 5}', 150),
('Hot Hand', 'Score 5 consecutive goals', 'fire', 'shooting', '{"consecutive_goals": 5}', 75),
('Long Range Specialist', 'Score 5+ goals from 8m+ distance', 'rocket', 'shooting', '{"min_goals": 5, "min_distance": 8}', 80),
('Zone Master', 'Shoot above 70% in all three zones (left/center/right) in a game', 'star', 'shooting', '{"min_fg_all_zones": 70, "min_shots_per_zone": 3}', 120),

-- Consistency achievements  
('Iron Man', 'Play in 10 consecutive games', 'muscle', 'consistency', '{"consecutive_games": 10}', 50),
('Reliable Scorer', 'Score at least 5 goals in 5 consecutive games', 'medal', 'consistency', '{"min_goals": 5, "consecutive_games": 5}', 100),
('Steady Eddie', 'Maintain 50%+ FG% for 8 consecutive games (min 8 shots per game)', 'chart', 'consistency', '{"min_fg_percentage": 50, "consecutive_games": 8, "min_shots": 8}', 90),

-- Improvement achievements
('Rising Star', 'Improve FG% by 20+ percentage points over 5 games', 'rising', 'improvement', '{"fg_improvement": 20, "games_span": 5}', 80),
('Comeback Kid', 'Score 8+ goals after scoring 2 or fewer in previous game', 'hero', 'improvement', '{"min_goals": 8, "previous_max_goals": 2}', 70),
('Practice Pays Off', 'Increase average shot distance by 2m+ while maintaining 50%+ FG%', 'trending', 'improvement', '{"distance_increase": 2, "min_fg_percentage": 50}', 85),

-- Milestone achievements
('Century Club', 'Score 100 career goals', 'century', 'milestone', '{"total_goals": 100}', 200),
('500 Shots', 'Attempt 500 career shots', 'target500', 'milestone', '{"total_shots": 500}', 150),
('Elite Shooter', 'Achieve 60%+ career FG% (min 100 shots)', 'crown', 'milestone', '{"min_fg_percentage": 60, "min_total_shots": 100}', 250),
('Team Player', 'Participate in 25 games', 'team', 'milestone', '{"games_played": 25}', 100),
('Hat Trick Hero', 'Score 3+ goals in 20 different games', 'hat', 'milestone', '{"hat_tricks": 20}', 180)
ON CONFLICT (name) DO NOTHING;
