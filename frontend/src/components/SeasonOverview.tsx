import React from 'react';
import type { TeamAnalyticsOverviewResponse } from '../types/team-analytics';

type SeasonOverviewProps = {
  overview: TeamAnalyticsOverviewResponse;
};

const formatSigned = (value: number, suffix: string = ''): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}${suffix}`;
};

const SeasonOverview: React.FC<SeasonOverviewProps> = ({ overview }) => {
  const comparison = overview.previous_season_comparison;

  return (
    <section className="team-analytics__section" aria-labelledby="team-analytics-season-overview">
      <div className="team-analytics__section-heading">
        <div>
          <h2 id="team-analytics-season-overview">Season Overview</h2>
          <p>
            {overview.team.club_name ? `${overview.team.club_name} • ` : ''}
            {overview.team.name}
          </p>
        </div>
      </div>

      <div className="team-analytics__cards">
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Record</span>
          <strong>{overview.record.wins}-{overview.record.losses}-{overview.record.draws}</strong>
          <span>{overview.record.games_played} completed games</span>
        </article>
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Win Rate</span>
          <strong>{overview.record.win_percentage.toFixed(1)}%</strong>
          <span>{overview.record.points} points</span>
        </article>
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Shot Efficiency</span>
          <strong>{overview.scoring.fg_percentage.toFixed(1)}%</strong>
          <span>{overview.scoring.total_goals} goals from {overview.scoring.total_shots} shots</span>
        </article>
        <article className="team-analytics__card">
          <span className="team-analytics__card-label">Goal Difference</span>
          <strong>{overview.scoring.goal_difference >= 0 ? '+' : ''}{overview.scoring.goal_difference}</strong>
          <span>{overview.scoring.avg_goal_difference.toFixed(2)} per game</span>
        </article>
      </div>

      <div className="team-analytics__grid team-analytics__grid--two-column">
        <article className="team-analytics__panel">
          <h3 id="team-analytics-top-scorers">Top Scorers</h3>
          {overview.top_scorers.length === 0 ? (
            <p className="team-analytics__empty" role="status" aria-live="polite">No scorer data available for this season.</p>
          ) : (
            <div className="team-analytics__table-wrap">
              <table className="team-analytics__table" aria-labelledby="team-analytics-top-scorers">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Goals</th>
                    <th>Shots</th>
                    <th>FG%</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.top_scorers.map((scorer) => (
                    <tr key={scorer.player_id}>
                      <td>
                        {scorer.jersey_number ? `#${scorer.jersey_number} ` : ''}
                        {scorer.player_name}
                      </td>
                      <td>{scorer.goals}</td>
                      <td>{scorer.shots}</td>
                      <td>{scorer.fg_percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="team-analytics__panel">
          <h3 id="team-analytics-period-breakdown">Period Breakdown</h3>
          {overview.period_breakdown.length === 0 ? (
            <p className="team-analytics__empty" role="status" aria-live="polite">No period data available for this season.</p>
          ) : (
            <div className="team-analytics__table-wrap">
              <table className="team-analytics__table" aria-labelledby="team-analytics-period-breakdown">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Goals</th>
                    <th>Shots</th>
                    <th>FG%</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.period_breakdown.map((period) => (
                    <tr key={period.period}>
                      <td>P{period.period}</td>
                      <td>{period.goals}</td>
                      <td>{period.shots}</td>
                      <td>{period.fg_percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>

      <article className="team-analytics__panel">
        <h3>Previous Season Comparison</h3>
        {!comparison ? (
          <p className="team-analytics__empty" role="status" aria-live="polite">No previous-season baseline is available yet.</p>
        ) : (
          <div className="team-analytics__comparison-grid">
            <div>
              <span className="team-analytics__muted">Previous season</span>
              <strong>{comparison.season.name}</strong>
            </div>
            <div>
              <span className="team-analytics__muted">Record</span>
              <strong>{comparison.record.wins}-{comparison.record.losses}-{comparison.record.draws}</strong>
            </div>
            <div>
              <span className="team-analytics__muted">Win rate delta</span>
              <strong>{formatSigned(comparison.deltas.win_percentage, '%')}</strong>
            </div>
            <div>
              <span className="team-analytics__muted">Goals per game delta</span>
              <strong>{formatSigned(comparison.deltas.goals_for_per_game)}</strong>
            </div>
            <div>
              <span className="team-analytics__muted">FG% delta</span>
              <strong>{formatSigned(comparison.deltas.fg_percentage, '%')}</strong>
            </div>
            <div>
              <span className="team-analytics__muted">Goal diff / game delta</span>
              <strong>{formatSigned(comparison.deltas.goal_difference_per_game)}</strong>
            </div>
          </div>
        )}
      </article>
    </section>
  );
};

export default SeasonOverview;