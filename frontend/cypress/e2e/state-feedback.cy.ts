const ADMIN_USER = {
  id: 1,
  username: 'cypadmin',
  email: 'cypadmin@example.com',
  role: 'admin',
};

const clubs = [
  { id: 1, name: 'Alpha Club' },
  { id: 2, name: 'Beta Club' },
];

const teams = [
  { id: 1, name: 'Team Alpha', club_id: 1, club_name: 'Alpha Club', age_group: 'U17', gender: 'mixed', is_active: true },
  { id: 2, name: 'Team Beta', club_id: 2, club_name: 'Beta Club', age_group: 'Seniors', gender: 'female', is_active: true },
];

const players = [
  { id: 1, club_id: 1, team_id: 1, first_name: 'John', last_name: 'Doe', jersey_number: 10, is_active: true, team_name: 'Team Alpha', club_name: 'Alpha Club' },
];

const games = [
  {
    id: 1,
    home_team_id: 1,
    away_team_id: 2,
    home_team_name: 'Team Alpha',
    away_team_name: 'Team Beta',
    date: '2025-11-10T10:00:00Z',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    created_at: '2025-11-06T10:00:00Z',
    updated_at: '2025-11-06T10:00:00Z',
  },
];

const matchTemplates = [
  {
    id: 1,
    name: 'Standard Match',
    description: 'Standard match template',
    number_of_periods: 4,
    period_duration_minutes: 10,
    competition_type: 'league',
    is_system_template: true,
    allow_same_team: false,
  },
];

const visitWithAdmin = (path: string) => {
  cy.visit(path, {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', 'cypress-token');
      win.localStorage.setItem('user', JSON.stringify(ADMIN_USER));
    },
  });
};

describe('State feedback flows', () => {
  it('retries the team management page after an initial load failure', () => {
    let teamRequests = 0;

    cy.intercept('GET', '/api/clubs*', { statusCode: 200, body: clubs }).as('getClubs');
    cy.intercept('GET', '/api/teams*', (req) => {
      teamRequests += 1;
      if (teamRequests === 1) {
        req.reply({ statusCode: 500, body: { error: 'Failed to fetch teams' } });
        return;
      }

      req.reply({ statusCode: 200, body: teams });
    }).as('getTeamsStateful');

    visitWithAdmin('/teams');

    cy.wait('@getClubs');
    cy.wait('@getTeamsStateful');
    cy.contains('Team action failed').should('be.visible');
    cy.contains('Failed to fetch teams').should('be.visible');
    cy.contains('.team-card', 'Team Alpha').should('be.visible');

    cy.contains('button', 'Reload teams').click();

    cy.wait('@getTeamsStateful');
    cy.contains('.team-card', 'Team Alpha').should('be.visible');
    cy.contains('Team action failed').should('not.exist');
  });

  it('shows the empty state for users when no accounts exist', () => {
    cy.intercept('GET', '/api/users*', { statusCode: 200, body: [] }).as('getUsers');

    visitWithAdmin('/users');

    cy.wait('@getUsers');
    cy.contains('No users found').should('be.visible');
    cy.contains('Create the first user account to start assigning roles and permissions.').should('be.visible');
    cy.contains('button', 'Create user').should('be.visible');
  });

  it('retries the player management page after an initial load failure', () => {
    let playerTeamRequests = 0;

    cy.intercept('GET', '/api/clubs*', { statusCode: 200, body: clubs }).as('getPlayerClubs');
    cy.intercept('GET', '/api/teams*', (req) => {
      playerTeamRequests += 1;
      if (playerTeamRequests <= 2) {
        req.reply({ statusCode: 500, body: { error: 'Failed to fetch teams' } });
        return;
      }

      req.reply({ statusCode: 200, body: teams });
    }).as('getPlayerTeamsStateful');
    cy.intercept('GET', '/api/players*', { statusCode: 200, body: players }).as('getPlayers');

    visitWithAdmin('/players');

    cy.wait('@getPlayerClubs');
    cy.wait('@getPlayerTeamsStateful');
    cy.contains('Player action failed').should('be.visible');
    cy.contains('Failed to fetch teams').should('be.visible');
    cy.contains('John Doe').should('be.visible');

    cy.contains('button', 'Reload players').click();

    cy.wait('@getPlayerTeamsStateful');
    cy.wait('@getPlayers');
    cy.contains('Add New Player').should('be.visible');
    cy.contains('John Doe').should('be.visible');
    cy.contains('Player action failed').should('not.exist');
  });

  it('shows inline action feedback when game creation fails', () => {
    cy.intercept('GET', '/api/auth/csrf', { statusCode: 200, body: { csrfToken: 'cypress-csrf-token' } }).as('getCsrf');
    cy.intercept('GET', '/api/teams*', { statusCode: 200, body: teams }).as('getGameTeams');
    cy.intercept('GET', '/api/games*', { statusCode: 200, body: games }).as('getGames');
    cy.intercept('GET', '/api/match-templates*', { statusCode: 200, body: matchTemplates }).as('getTemplates');
    cy.intercept('POST', '/api/games', { statusCode: 409, body: { error: 'Team conflict: both teams already have a game scheduled' } }).as('createGame');

    visitWithAdmin('/games');

    cy.wait('@getGameTeams');
    cy.wait('@getGames');
    cy.wait('@getTemplates');

    cy.contains('button', 'Create New Game').click();
    cy.get('select').eq(1).select('Alpha Club');
    cy.get('select').eq(2).select('Team Alpha');
    cy.get('select').eq(3).select('Beta Club');
    cy.get('select').eq(4).select('Team Beta');
    cy.get('input[type="datetime-local"]').type('2025-11-15T16:00');
    cy.contains('button', 'Create Game').click();

    cy.wait('@getCsrf');
    cy.wait('@createGame');
    cy.contains('Game action failed').should('be.visible');
    cy.contains('Team conflict: both teams already have a game scheduled').should('be.visible');
    cy.contains('button', 'Reload games').should('be.visible');
  });
});