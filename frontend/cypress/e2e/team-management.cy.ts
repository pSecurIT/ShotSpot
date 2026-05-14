const COACH_USER = {
  id: 3,
  username: 'cypcoach',
  email: 'cypcoach@example.com',
  role: 'coach',
};

const ADMIN_USER = {
  id: 1,
  username: 'cypadmin',
  email: 'cypadmin@example.com',
  role: 'admin',
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

const visitTeams = (user = COACH_USER) => {
  cy.viewport(1280, 900);
  interceptTeamsPage();
  cy.visit('/teams', {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', 'cypress-token');
      win.localStorage.setItem('user', JSON.stringify(user));
      win.localStorage.setItem(`shotspot:onboarding:v1:${user.id}:${user.role}`, 'done');
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
    cy.get('#club_filter').scrollIntoView().select('2', { force: true });
    cy.contains('Team Beta').should('be.visible');
    cy.contains('Team Alpha').should('not.exist');
    cy.contains('Showing 1 of 2 teams').should('be.visible');

    cy.get('#team_filter').should('have.value', '');
    cy.get('#team_filter').select('2', { force: true });
    cy.contains('Team Beta').should('be.visible');
  });

  it('shows an empty state for a club with no teams', () => {
    cy.get('#club_filter').scrollIntoView().select('3', { force: true });

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

    cy.get('#new-team-club').scrollIntoView().select('2', { force: true });
    cy.get('#new-team-name').scrollIntoView().type('Beta Juniors', { force: true });
    cy.get('#new-team-age-group').scrollIntoView().type('U15', { force: true });
    cy.get('#new-team-gender').scrollIntoView().select('mixed', { force: true });
    cy.contains('button', /^Add Team$/).click({ force: true });

    cy.wait('@createTeam').its('request.body').should('deep.equal', {
      club_id: 2,
      name: 'Beta Juniors',
      age_group: 'U15',
      gender: 'mixed',
    });

    cy.contains('.team-card', 'Beta Juniors').should('be.visible');
  });

  it('rejects whitespace-only team names on create', () => {
    cy.intercept('POST', '/api/teams').as('createAttempt');

    cy.get('#new-team-name').scrollIntoView().type('   ', { force: true });
    cy.contains('button', /^Add Team$/).click({ force: true });

    cy.contains('Team name is required').should('be.visible');
    cy.get('@createAttempt.all').should('have.length', 0);
  });

  it('edits a team after clicking its card', () => {
    cy.intercept('PUT', '/api/teams/1', {
      statusCode: 200,
      body: { id: 1, name: 'Team Apex', age_group: 'U19', gender: 'female', is_active: true },
    }).as('updateTeam');

    cy.contains('.team-card', 'Team Alpha').scrollIntoView().click({ force: true });
    cy.contains('Edit Team').should('be.visible');
    cy.get('#edit-team-name').scrollIntoView().clear({ force: true }).type('Team Apex', { force: true });
    cy.get('#edit-team-age-group').scrollIntoView().clear({ force: true }).type('U19', { force: true });
    cy.get('#edit-team-gender').scrollIntoView().select('female', { force: true });
    cy.contains('button', 'Update Team').click({ force: true });

    cy.wait('@updateTeam').its('request.body').should('deep.equal', {
      name: 'Team Apex',
      age_group: 'U19',
      gender: 'female',
      is_active: true,
    });

    cy.contains('.team-card', 'Team Apex').should('be.visible');
  });

  it('allows admins to move a team to another club from edit form', () => {
    visitTeams(ADMIN_USER);

    cy.intercept('PUT', '/api/teams/1', {
      statusCode: 200,
      body: { id: 1, club_id: 2, name: 'Team Alpha', age_group: 'U17', gender: 'mixed', is_active: true },
    }).as('updateTeamClub');

    cy.contains('.team-card', 'Team Alpha').scrollIntoView().click({ force: true });
    cy.get('#edit-team-club').should('be.visible').scrollIntoView().select('2', { force: true });
    cy.contains('button', 'Update Team').click({ force: true });

    cy.wait('@updateTeamClub').its('request.body').should('deep.equal', {
      club_id: 2,
      name: 'Team Alpha',
      age_group: 'U17',
      gender: 'mixed',
      is_active: true,
    });

    cy.contains('.team-card', 'Team Alpha').within(() => {
      cy.contains('Beta Club').should('be.visible');
    });
  });

  it('does not show club selector for coaches when editing', () => {
    cy.contains('.team-card', 'Team Alpha').scrollIntoView().click({ force: true });
    cy.get('#edit-team-club').should('not.exist');
  });

  it('sends update payload without club_id for coaches', () => {
    cy.intercept('PUT', '/api/teams/1', {
      statusCode: 200,
      body: { id: 1, club_id: 1, name: 'Coach Team', age_group: 'U17', gender: 'mixed', is_active: true },
    }).as('coachUpdateTeam');

    cy.contains('.team-card', 'Team Alpha').scrollIntoView().click({ force: true });
    cy.get('#edit-team-name').scrollIntoView().clear({ force: true }).type('Coach Team', { force: true });
    cy.contains('button', 'Update Team').click({ force: true });

    cy.wait('@coachUpdateTeam').its('request.body').should('deep.equal', {
      name: 'Coach Team',
      age_group: 'U17',
      gender: 'mixed',
      is_active: true,
    });
  });

  it('opens the export dialog for a team', () => {
    cy.contains('.team-card', 'Team Alpha').within(() => {
      cy.contains('button', /export season summary/i).click({ force: true });
    });

    cy.contains('Export Team Alpha Season Summary').should('be.visible');
    cy.contains('Select Format').should('be.visible');
    cy.get('[aria-label="Close dialog"]').click({ force: true });
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

    cy.contains('.team-card', 'Team Alpha').scrollIntoView().click({ force: true });
    cy.contains('button', 'Remove Team').click({ force: true });

    cy.wait('@deleteTeam');
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

    cy.contains('.team-card', 'Team Alpha').scrollIntoView().click({ force: true });
    cy.contains('button', 'Remove Team').click({ force: true });

    cy.wait('@deleteTeam');
    cy.contains('Team cannot be removed while players are assigned.').should('be.visible');
    cy.contains('.team-card', 'Team Alpha').should('be.visible');
  });
});