const COACH_USER = {
  id: 3,
  username: 'cypcoach',
  email: 'cypcoach@example.com',
  role: 'coach',
};

const seedAuth = (user = COACH_USER) => {
  cy.visit('/dashboard', {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', 'cypress-token');
      win.localStorage.setItem('user', JSON.stringify(user));
      win.localStorage.setItem('language', 'en');
      win.localStorage.setItem('emailNotifications', 'false');
    },
  });
};

const expectNoPageOverflow = () => {
  cy.document().then((doc) => {
    expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth + 4);
    expect(doc.body.scrollWidth).to.be.lte(doc.body.clientWidth + 4);
  });
};

const expectContainerOwnsHorizontalOverflow = (selector: string) => {
  cy.get(selector).then(($element) => {
    const element = $element[0];
    const { overflowX } = window.getComputedStyle(element);

    expect(['auto', 'scroll', 'clip']).to.include(overflowX);

    if (element.scrollWidth > element.clientWidth) {
      expect(element.scrollWidth).to.be.greaterThan(element.clientWidth);
    }
  });
};

const mockDashboardData = () => {
  cy.intercept('GET', '/api/games?limit=5&sort=recent', { statusCode: 200, body: [] }).as('recentGames');
  cy.intercept('GET', '/api/games?status=upcoming', { statusCode: 200, body: [] }).as('upcomingGames');
  cy.intercept('GET', '/api/achievements/recent?limit=8', { statusCode: 200, body: [] }).as('recentAchievements');
  cy.intercept('GET', '/api/dashboard/summary', { statusCode: 200, body: { teams: 4, players: 34, games: 12 } }).as('dashboardSummary');
};

const mockSettingsData = () => {
  cy.intercept('GET', '/api/export-settings', {
    statusCode: 200,
    body: {
      id: 1,
      user_id: 3,
      default_format: 'pdf',
      default_template_id: null,
      anonymize_opponents: false,
      include_sensitive_data: true,
      auto_delete_after_days: null,
      allow_public_sharing: false,
      allowed_share_roles: ['coach', 'admin'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  }).as('exportSettings');
  cy.intercept('GET', '/api/clubs', { statusCode: 200, body: [{ id: 1, name: 'ShotSpot Club' }] }).as('clubs');
  cy.intercept('GET', '/api/teams', { statusCode: 200, body: [{ id: 2, name: 'First Team', club_id: 1, club_name: 'ShotSpot Club' }] }).as('settingsTeams');
};

const mockShotAnalyticsData = () => {
  cy.intercept('GET', '/api/analytics/shots/123/heatmap*', {
    statusCode: 200,
    body: {
      grid_size: 10,
      data: [
        { x: 0, y: 0, count: 4, goals: 2, misses: 1, blocked: 1, success_rate: 50 },
        { x: 2, y: 1, count: 7, goals: 5, misses: 2, blocked: 0, success_rate: 71.4 },
      ],
    },
  }).as('shotHeatmap');
  cy.intercept('GET', '/api/analytics/shots/123/summary*', {
    statusCode: 200,
    body: {
      overall: {
        total_shots: 18,
        total_goals: 11,
        total_misses: 5,
        total_blocked: 2,
        overall_fg_percentage: 61.1,
      },
      by_team: [
        {
          team_id: 4,
          team_name: 'Falcons',
          total_shots: 10,
          goals: 6,
          misses: 3,
          blocked: 1,
          fg_percentage: 60,
        },
      ],
    },
  }).as('summaryStats');
  cy.intercept('GET', '/api/analytics/shots/123/players*', {
    statusCode: 200,
    body: [
      {
        player_id: 1,
        first_name: 'Alex',
        last_name: 'Arrow',
        jersey_number: 9,
        team_name: 'Falcons',
        team_id: 4,
        total_shots: 10,
        goals: 6,
        misses: 3,
        blocked: 1,
        field_goal_percentage: 60,
        average_distance: 5.5,
        zone_performance: {
          left: { shots: 4, goals: 2, misses: 1, blocked: 1, success_rate: 50 },
          center: { shots: 3, goals: 2, misses: 1, blocked: 0, success_rate: 66.7 },
          right: { shots: 3, goals: 2, misses: 1, blocked: 0, success_rate: 66.7 },
        },
      },
    ],
  }).as('playerStats');
};

const mockExportCenterData = () => {
  cy.intercept('GET', '/api/exports/recent', {
    statusCode: 200,
    body: [
      {
        id: 1,
        name: 'Game Report - Team A vs Team B',
        format: 'pdf-detailed',
        dataType: 'game',
        createdAt: '2026-04-11T18:00:00.000Z',
        size: '2.3 MB',
        status: 'completed',
        downloadUrl: '/exports/1',
      },
    ],
  }).as('recentExports');
  cy.intercept('GET', '/api/exports/templates', {
    statusCode: 200,
    body: [
      {
        id: 1,
        name: 'Match Summary',
        description: 'Quick overview with key statistics',
        format: 'pdf-summary',
        options: { includeCharts: true, includePlayerStats: true },
      },
    ],
  }).as('exportTemplates');
  cy.intercept('GET', '/api/teams', {
    statusCode: 200,
    body: [{ id: 1, name: 'Test Team' }],
  }).as('exportTeams');
};

const mockReportTemplatesData = () => {
  cy.intercept('GET', '/api/report-templates', {
    statusCode: 200,
    body: [
      {
        id: 3,
        name: 'Game Summary',
        type: 'summary',
        description: 'Default summary report',
        sections: [
          {
            id: 'section-1',
            type: 'summary',
            title: 'Executive Summary',
            description: 'Summary section',
            config: {
              metricIds: ['goals'],
              columns: 2,
              showComparison: true,
              chartType: 'bar',
              timeframe: 'full_match',
              tone: 'neutral',
              maxItems: 3,
              includeTimestamps: true,
              layout: 'table',
              compareBy: 'team',
              highlightMetric: 'goals',
              emphasis: 'score',
              showCallout: true,
            },
          },
        ],
        metrics: ['goals'],
        is_default: true,
        is_active: true,
        created_by: null,
        created_by_username: 'system',
        branding: {},
        language: 'en',
        date_format: 'YYYY-MM-DD',
        time_format: '24h',
        created_at: '2026-03-20T10:00:00.000Z',
        updated_at: '2026-03-20T10:00:00.000Z',
      },
    ],
  }).as('reportTemplates');
};

const mockAchievementsData = () => {
  cy.intercept('GET', '/api/achievements/list', {
    statusCode: 200,
    body: [
      {
        id: 1,
        name: 'Sharpshooter',
        description: 'Score 10 goals in a single game',
        badge_icon: '🎯',
        category: 'shooting',
        criteria: { goals_in_game: 10 },
        points: 50,
      },
      {
        id: 2,
        name: 'Century Club',
        description: 'Reach 100 total goals',
        badge_icon: '💯',
        category: 'milestone',
        criteria: { career_goals: 100 },
        points: 100,
      },
    ],
  }).as('achievementsList');
  cy.intercept('GET', '/api/players', {
    statusCode: 200,
    body: [
      { id: 10, first_name: 'John', last_name: 'Doe', jersey_number: 7, team_id: 1, team_name: 'Team A' },
      { id: 11, first_name: 'Jane', last_name: 'Smith', jersey_number: 11, team_id: 2, team_name: 'Team B' },
    ],
  }).as('achievementPlayers');
  cy.intercept('GET', '/api/teams', {
    statusCode: 200,
    body: [
      { id: 1, name: 'Team A' },
      { id: 2, name: 'Team B' },
    ],
  }).as('achievementTeams');
  cy.intercept('GET', '/api/achievements/leaderboard', {
    statusCode: 200,
    body: {
      season: 'Current Season',
      leaderboard: [
        {
          rank: 1,
          id: 10,
          first_name: 'John',
          last_name: 'Doe',
          team_name: 'Team A',
          jersey_number: 7,
          total_shots: 80,
          total_goals: 52,
          fg_percentage: 65,
          achievement_points: 150,
          games_played: 12,
        },
      ],
    },
  }).as('globalLeaderboard');
  cy.intercept('GET', '/api/achievements/player/10', {
    statusCode: 200,
    body: {
      achievements: [
        {
          id: 101,
          name: 'Sharpshooter',
          description: 'Score 10 goals in a single game',
          badge_icon: '🎯',
          category: 'shooting',
          criteria: { goals_in_game: 10 },
          points: 50,
          earned_at: '2026-03-20T10:00:00.000Z',
        },
      ],
      total_points: 50,
    },
  }).as('playerAchievements');
};

const mockCompetitionStandingsData = () => {
  cy.intercept('GET', '/api/competitions/1/standings', {
    statusCode: 200,
    body: [
      {
        id: 101,
        competition_id: 1,
        team_id: 4,
        team_name: 'Falcons U19 A',
        games_played: 12,
        wins: 9,
        draws: 1,
        losses: 2,
        goals_for: 126,
        goals_against: 93,
        goal_difference: 33,
        points: 19,
      },
      {
        id: 102,
        competition_id: 1,
        team_id: 8,
        team_name: 'Wolves Senior',
        games_played: 12,
        wins: 8,
        draws: 2,
        losses: 2,
        goals_for: 119,
        goals_against: 97,
        goal_difference: 22,
        points: 18,
      },
    ],
  }).as('competitionStandings');
};

const mockCompetitionManagementData = () => {
  cy.intercept('GET', '/api/competitions', {
    statusCode: 200,
    body: [
      {
        id: 1,
        name: 'National Cup',
        competition_type: 'tournament',
        season_id: null,
        series_id: null,
        start_date: '2026-04-01',
        end_date: '2026-04-20',
        status: 'upcoming',
        settings: { format_config: { bracket_type: 'single_elimination' } },
        created_at: '2026-03-01T00:00:00.000Z',
        updated_at: '2026-03-01T00:00:00.000Z',
        team_count: 8,
      },
      {
        id: 2,
        name: 'Premier League',
        competition_type: 'league',
        season_id: null,
        series_id: null,
        start_date: '2026-01-10',
        end_date: '2026-06-01',
        status: 'in_progress',
        settings: { format_config: { points_win: 3, points_draw: 1, points_loss: 0 } },
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
        team_count: 10,
      },
    ],
  }).as('competitionsList');
};

const mockCompetitionBracketData = () => {
  cy.intercept('GET', '/api/competitions/1/teams', {
    statusCode: 200,
    body: [
      { competition_id: 1, team_id: 4, team_name: 'Falcons U19 A', seed: 1 },
      { competition_id: 1, team_id: 8, team_name: 'Wolves Senior', seed: 2 },
      { competition_id: 1, team_id: 9, team_name: 'Ravens', seed: 3 },
      { competition_id: 1, team_id: 10, team_name: 'Titans', seed: 4 },
    ],
  }).as('competitionTeams');
  cy.intercept('GET', '/api/competitions/1/bracket', {
    statusCode: 200,
    body: {
      competition_id: 1,
      rounds: [
        {
          round_number: 1,
          round_name: 'Semifinals',
          matches: [
            {
              id: 501,
              competition_id: 1,
              round_number: 1,
              round_name: 'Semifinals',
              match_number: 1,
              home_team_id: 4,
              away_team_id: 10,
              winner_team_id: null,
              game_id: null,
              home_team_name: 'Falcons U19 A',
              away_team_name: 'Titans',
              home_score: null,
              away_score: null,
              game_status: null,
            },
            {
              id: 502,
              competition_id: 1,
              round_number: 1,
              round_name: 'Semifinals',
              match_number: 2,
              home_team_id: 8,
              away_team_id: 9,
              winner_team_id: null,
              game_id: null,
              home_team_name: 'Wolves Senior',
              away_team_name: 'Ravens',
              home_score: null,
              away_score: null,
              game_status: null,
            },
          ],
        },
        {
          round_number: 2,
          round_name: 'Final',
          matches: [
            {
              id: 503,
              competition_id: 1,
              round_number: 2,
              round_name: 'Final',
              match_number: 1,
              home_team_id: null,
              away_team_id: null,
              winner_team_id: null,
              game_id: null,
              home_team_name: null,
              away_team_name: null,
              home_score: null,
              away_score: null,
              game_status: null,
            },
          ],
        },
      ],
    },
  }).as('competitionBracket');
};

const mockTeamAnalyticsData = () => {
  cy.intercept('GET', '/api/teams', {
    statusCode: 200,
    body: [
      { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      { id: 8, name: 'Senior', club_id: 2, club_name: 'Wolves', season_id: 11 },
    ],
  }).as('teamAnalyticsTeams');
  cy.intercept('GET', '/api/seasons', {
    statusCode: 200,
    body: [
      { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      { id: 11, name: '2024-2025', start_date: '2024-09-01', end_date: '2025-05-31', is_active: false },
    ],
  }).as('seasons');
  cy.intercept('GET', '/api/team-analytics/4/season-overview?season_id=10', {
    statusCode: 200,
    body: {
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      record: { games_played: 8, wins: 5, losses: 2, draws: 1, points: 11, win_percentage: 62.5 },
      scoring: { total_shots: 98, total_goals: 56, fg_percentage: 57.1, goals_for: 83, goals_against: 69, goal_difference: 14, avg_goals_for: 10.38, avg_goals_against: 8.63, avg_goal_difference: 1.75 },
      top_scorers: [{ player_id: 12, player_name: 'Alex Arrow', jersey_number: 9, goals: 18, shots: 29, fg_percentage: 62.1 }],
      period_breakdown: [{ period: 1, goals: 14, shots: 25, fg_percentage: 56 }],
      previous_season_comparison: null,
    },
  }).as('seasonOverview');
  cy.intercept('GET', '/api/team-analytics/4/momentum?season_id=10', {
    statusCode: 200,
    body: {
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      trend: [{ game_id: 31, game_date: '2026-03-01T12:00:00.000Z', opponent_name: 'Ravens', venue: 'home', result: 'W', goals_for: 12, goals_against: 9, goal_difference: 3, shots: 14, goals: 12, fg_percentage: 85.7, momentum_score: 74, rolling_fg_percentage: 62.5, rolling_points_per_game: 1.8 }],
      summary: { current_streak: 'W3', last_five_record: '3-1-1', last_five_points: 7, average_momentum: 68.3 },
    },
  }).as('momentum');
  cy.intercept('GET', '/api/team-analytics/4/strengths-weaknesses?season_id=10', {
    statusCode: 200,
    body: {
      team: { id: 4, name: 'U19 A', club_id: 2, club_name: 'Falcons', season_id: 10 },
      season: { id: 10, name: '2025-2026', start_date: '2025-09-01', end_date: '2026-05-31', is_active: true },
      scope_mode: 'team',
      benchmarks: { win_percentage: 48.5, goals_for_per_game: 9.2, goals_against_per_game: 9.7, fg_percentage: 51.8, goal_difference_per_game: -0.1 },
      strengths: [{ title: 'Shot efficiency', description: 'Converts chances well above the season benchmark.', metric: 'fg_percentage', value: 57.1, benchmark: 51.8, delta: 5.3 }],
      weaknesses: [{ title: 'Defensive control', description: 'Still concedes slightly more than the strongest teams in the league.', metric: 'goals_against_per_game', value: 8.63, benchmark: 7.9, delta: -0.73 }],
      period_breakdown: [{ period: 1, goals: 14, shots: 25, fg_percentage: 56 }],
    },
  }).as('strengthsWeaknesses');
};

describe('Responsive layout polish', () => {
  it('keeps the dashboard and collapsed navigation within the mobile viewport', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    seedAuth();

    cy.get('.dashboard__title').should('be.visible').and('contain.text', 'Dashboard');
    cy.get('[aria-label="Main navigation"] button[aria-label="Open navigation menu"]').click();
    cy.get('[role="dialog"][aria-label="Navigation menu"]').should('be.visible');
    expectNoPageOverflow();
  });

  it('keeps settings tabs and forms inside the mobile viewport', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockSettingsData();
    seedAuth();

    cy.visit('/settings');

    cy.get('.settings-page__header h2').should('be.visible').and('have.text', 'Settings');
    cy.contains('button', 'User Preferences').click();
    cy.contains('button', 'Account Settings').click();
    expectNoPageOverflow();
  });

  it('keeps shot analytics inside the mobile viewport', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockShotAnalyticsData();
    seedAuth();

    cy.visit('/analytics/123');

    cy.get('.analytics-header h2').should('be.visible').and('contain.text', 'Shot Analytics');
    expectNoPageOverflow();
  });

  it('keeps player stats table overflow inside its own container on mobile', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockShotAnalyticsData();
    seedAuth();

    cy.visit('/analytics/123');

    cy.contains('button', '👤 Player Stats').click();
    cy.wait('@playerStats');
    cy.get('.player-stats-table').should('be.visible');
    expectContainerOwnsHorizontalOverflow('.player-stats-table');
    expectNoPageOverflow();
  });

  it('keeps export center inside the mobile viewport while allowing local tab scrolling', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockExportCenterData();
    seedAuth();

    cy.visit('/exports');

    cy.get('.export-center-header h2').should('be.visible').and('have.text', 'Export Center');
    cy.get('.export-tabs').should('be.visible');
    expectContainerOwnsHorizontalOverflow('.export-tabs');
    expectNoPageOverflow();
  });

  it('keeps report templates inside the mobile viewport', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockReportTemplatesData();
    seedAuth();

    cy.visit('/report-templates');

    cy.get('.report-templates-page__header h1').should('be.visible').and('have.text', 'Report Templates');
    cy.get('.report-templates-page__layout').should('be.visible');
    cy.get('.report-templates-page__list-select').should('be.visible');
    expectNoPageOverflow();
  });

  it('keeps achievements leaderboard overflow inside its own table container on mobile', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockAchievementsData();
    seedAuth();

    cy.visit('/achievements');

    cy.contains('Leaderboards').should('be.visible');
    cy.get('.leaderboard__table-container').should('be.visible');
    expectContainerOwnsHorizontalOverflow('.leaderboard__table-container');
    expectNoPageOverflow();
  });

  it('keeps competition standings inside the mobile viewport while allowing table-card overflow', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockCompetitionStandingsData();
    seedAuth();

    cy.visit('/competitions/1/standings');

    cy.get('.competition-management__header h2').should('be.visible').and('have.text', 'League Standings');
    cy.wait('@competitionStandings');
    cy.get('.competition-card').should('be.visible');
    expectContainerOwnsHorizontalOverflow('.competition-card');
    expectNoPageOverflow();
  });

  it('keeps competition management inside the mobile viewport', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockCompetitionManagementData();
    seedAuth();

    cy.visit('/competitions');

    cy.get('.competition-management__header h2').should('be.visible').and('have.text', 'Competitions Management');
    cy.wait('@competitionsList');
    cy.get('.competition-grid').should('be.visible');
    expectNoPageOverflow();
  });

  it('keeps tournament bracket overflow inside its own canvas on mobile', () => {
    cy.viewport('iphone-6');
    mockDashboardData();
    mockCompetitionBracketData();
    seedAuth();

    cy.visit('/competitions/1/bracket');

    cy.get('.competition-management__header h2').should('be.visible').and('have.text', 'Tournament Bracket');
    cy.wait('@competitionTeams');
    cy.wait('@competitionBracket');
    cy.get('.tournament-bracket__canvas').should('be.visible');
    expectContainerOwnsHorizontalOverflow('.tournament-bracket__canvas');
    expectNoPageOverflow();
  });

  it('keeps team analytics inside a tablet viewport', () => {
    cy.viewport('ipad-2');
    mockDashboardData();
    mockTeamAnalyticsData();
    seedAuth();

    cy.visit('/team-analytics');

    cy.get('.team-analytics__hero h1').should('be.visible').and('have.text', 'Team Analytics Dashboard');
    cy.contains('Momentum Tracking').should('exist');
    expectNoPageOverflow();
  });
});

export {};