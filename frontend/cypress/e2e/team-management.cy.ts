const COACH_USER = {
  id: 3,
  username: 'cypcoach',
  email: 'cypcoach@example.com',
  role: 'coach',
};

const clubs = [
  { id: 1, name: 'Alpha Club' },
  { id: 2, name: 'Beta Club' },
  { id: 3, name: 'Gamma Club' },
];

const teams = [
  { id: 1, name: 'Team Alpha', club_id: 1, club_name: 'Alpha Club', age_group: 'U17', gender: 'mixed', is_active: true },
  { id: 2, name: 'Team Beta', club_id: 2, club_name: 'Beta Club', age_group: 'Seniors', gender: 'female', is_active: true },
];

const seedAuth = (user = COACH_USER) => {
  cy.window().then((win) => {
    win.localStorage.setItem('token', 'cypress-token');
    win.localStorage.setItem('user', JSON.stringify(user));
  });
};

const interceptTeamsPage = (teamBody = teams, clubBody = clubs) => {
  cy.intercept('GET', '/api/teams*', { statusCode: 200, body: teamBody }).as('getTeams');
  cy.intercept('GET', '/api/clubs*', { statusCode: 200, body: clubBody }).as('getClubs');
};

const visitTeams = () => {
  interceptTeamsPage();
  cy.visit('/teams', {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', 'cypress-token');
      win.localStorage.setItem('user', JSON.stringify(COACH_USER));
    },
  });
  cy.wait('@getClubs');
  cy.wait('@getTeams');
};

describe('Team Management: Page load', () => {
  it('redirects to /login when unauthenticated', () => {
    cy.visit('/teams');
    cy.url().should('include', '/login');
  });

  it('renders the team management page with fetched teams', () => {
    visitTeams();
    cy.contains('Team Management').should('be.visible');
    cy.contains('Team Alpha').should('be.visible');
    cy.contains('Team Beta').should('be.visible');
    cy.contains('Showing 2 of 2 teams').should('be.visible');
  });
});

describe('Team Management: Filters', () => {
  beforeEach(() => {
    visitTeams();
  });

  it('filters teams by club and team', () => {
    cy.get('#club_filter').select('2');
    cy.contains('Team Beta').should('be.visible');
    cy.contains('Team Alpha').should('not.exist');
    cy.contains('Showing 1 of 2 teams').should('be.visible');

    cy.get('#team_filter').should('have.value', '');
    cy.get('#team_filter').select('2');
    cy.contains('Team Beta').should('be.visible');
  });

  it('shows an empty state for a club with no teams', () => {
    cy.get('#club_filter').select('3');

    cy.contains('No teams found.').should('be.visible');
    cy.contains('Showing 0 of 2 teams').should('be.visible');
  });
});

describe('Team Management: Create, edit, and export', () => {
  beforeEach(() => {
    visitTeams();
  });

  it('creates a team and shows it in the list', () => {
    const createdTeam = {
      id: 3,
      name: 'Beta Juniors',
      club_id: 2,
      club_name: 'Beta Club',
      age_group: 'U15',
      gender: 'mixed',
      is_active: true,
    };

    cy.intercept('POST', '/api/teams', { statusCode: 201, body: createdTeam }).as('createTeam');

    cy.get('#new-team-club').select('2');
    cy.get('#new-team-name').type('Beta Juniors');
    cy.get('#new-team-age-group').type('U15');
    cy.get('#new-team-gender').select('mixed');
    cy.contains('button', /^Add Team$/).click();

    cy.wait('@createTeam').its('request.body').should('deep.equal', {
      club_id: 2,
      name: 'Beta Juniors',
      age_group: 'U15',
      gender: 'mixed',
    });

    cy.contains('Team created successfully!').should('be.visible');
    cy.contains('.team-card', 'Beta Juniors').should('be.visible');
  });

  it('edits a team after clicking its card', () => {
    cy.intercept('PUT', '/api/teams/1', {
      statusCode: 200,
      body: { id: 1, name: 'Team Apex', age_group: 'U19', gender: 'female', is_active: true },
    }).as('updateTeam');

    cy.contains('.team-card', 'Team Alpha').click();
    cy.contains('Edit Team').should('be.visible');
    cy.get('#edit-team-name').clear().type('Team Apex');
    cy.get('#edit-team-age-group').clear().type('U19');
    cy.get('#edit-team-gender').select('female');
    cy.contains('button', 'Update Team').click();

    cy.wait('@updateTeam').its('request.body').should('deep.equal', {
      name: 'Team Apex',
      age_group: 'U19',
      gender: 'female',
      is_active: true,
    });

    cy.contains('Team updated successfully!').should('be.visible');
    cy.contains('.team-card', 'Team Apex').should('be.visible');
  });

  it('opens the export dialog for a team', () => {
    cy.contains('.team-card', 'Team Alpha').within(() => {
      cy.contains('button', /export season summary/i).click();
    });

    cy.contains('Export Team Alpha Season Summary').should('be.visible');
    cy.contains('Select Format').should('be.visible');
    cy.get('[aria-label="Close dialog"]').click();
    cy.contains('Export Team Alpha Season Summary').should('not.exist');
  });
});

describe('Team Management: Delete errors', () => {
  beforeEach(() => {
    visitTeams();
  });

  it('removes a team after confirmation and updates the list', () => {
    cy.intercept('DELETE', '/api/teams/1', {
      statusCode: 204,
      body: {},
    }).as('deleteTeam');

    cy.on('window:confirm', () => true);

    cy.contains('.team-card', 'Team Alpha').click();
    cy.contains('button', 'Remove Team').click();

    cy.wait('@deleteTeam');
    cy.contains('Team removed successfully!').should('be.visible');
    cy.contains('.team-card', 'Team Alpha').should('not.exist');
    cy.contains('.team-card', 'Team Beta').should('be.visible');
    cy.contains('Edit Team').should('not.exist');
    cy.contains('Showing 1 of 1 teams').should('be.visible');
  });

  it('shows a backend delete error when a team cannot be removed', () => {
    cy.intercept('DELETE', '/api/teams/1', {
      statusCode: 409,
      body: { details: 'Team cannot be removed while players are assigned.' },
    }).as('deleteTeam');

    cy.on('window:confirm', () => true);

    cy.contains('.team-card', 'Team Alpha').click();
    cy.contains('button', 'Remove Team').click();

    cy.wait('@deleteTeam');
    cy.contains('Team cannot be removed while players are assigned.').should('be.visible');
    cy.contains('.team-card', 'Team Alpha').should('be.visible');
  });
});