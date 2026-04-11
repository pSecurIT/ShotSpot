/**
 * E2E tests for Competition Management flows.
 *
 * These tests assume the dev server is running on http://localhost:3000.
 * API calls are intercepted with cy.intercept() so no real backend is required.
 */

const COACH_USER = {
  id: 3,
  username: 'cypcoach',
  email: 'cypcoach@example.com',
  role: 'coach',
};

const COMPETITION_FIXTURE = {
  id: 1,
  name: 'Spring League 2025',
  competition_type: 'league',
  status: 'upcoming',
  start_date: '2025-03-01',
  end_date: '2025-06-30',
  season_id: null,
  series_id: null,
  settings: { format_config: {} },
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

const TOURNAMENT_FIXTURE = {
  id: 2,
  name: 'Cup Finals 2025',
  competition_type: 'tournament',
  status: 'in_progress',
  start_date: '2025-05-01',
  end_date: '2025-05-31',
  season_id: null,
  series_id: null,
  settings: { format_config: {} },
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
};

/** Intercept the competitions list API call with an optional body override. */
const interceptCompetitionsList = (body: unknown[] = []) => {
  cy.intercept('GET', '/api/competitions*', { statusCode: 200, body }).as('getCompetitions');
};

const interceptSeasonsEmpty = () => {
  cy.intercept('GET', '/api/seasons*', { statusCode: 200, body: [] }).as('getSeasons');
};

const interceptSeriesEmpty = () => {
  cy.intercept('GET', '/api/series*', { statusCode: 200, body: [] }).as('getSeries');
};

const visitCompetitions = (user = COACH_USER) => {
  interceptCompetitionsList([COMPETITION_FIXTURE, TOURNAMENT_FIXTURE]);
  interceptSeasonsEmpty();
  interceptSeriesEmpty();

  cy.visit('/competitions', {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', 'cypress-token');
      win.localStorage.setItem('user', JSON.stringify(user));
    },
  });
};

describe('Competitions: Page load', () => {
  it('redirects to /login when not authenticated', () => {
    cy.visit('/competitions');
    cy.url().should('include', '/login');
  });

  it('renders the Competitions page heading', () => {
    visitCompetitions();
    cy.contains(/competitions/i).should('be.visible');
  });

  it('displays competitions returned by the API', () => {
    visitCompetitions();
    cy.wait('@getCompetitions');
    cy.contains('Spring League 2025').should('be.visible');
    cy.contains('Cup Finals 2025').should('be.visible');
  });
});

describe('Competitions: Filtering', () => {
  beforeEach(() => {
    visitCompetitions();
    cy.wait('@getCompetitions');
  });

  it('can filter competitions by type', () => {
    cy.get('select[aria-label="Filter by type"]').select('league');
    cy.contains('Spring League 2025').should('be.visible');
    cy.contains('Cup Finals 2025').should('not.exist');
  });

  it('can filter competitions by status', () => {
    cy.get('select[aria-label="Filter by status"]').select('in_progress');
    cy.contains('Cup Finals 2025').should('be.visible');
    cy.contains('Spring League 2025').should('not.exist');
  });

  it('can search competitions by name', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]')
      .first()
      .type('Spring');
    cy.contains('Spring League 2025').should('be.visible');
    cy.contains('Cup Finals 2025').should('not.exist');
  });

  it('shows an empty state when no competitions match the search', () => {
    cy.get('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]')
      .first()
      .type('zzzzznonexistent');
    cy.contains('Spring League 2025').should('not.exist');
    cy.contains('Cup Finals 2025').should('not.exist');
  });
});

describe('Competitions: Create competition dialog', () => {
  beforeEach(() => {
    visitCompetitions();
    cy.wait('@getCompetitions');
  });

  it('opens the create competition dialog', () => {
    cy.contains('button', /new competition|add competition|create/i).click();
    cy.contains(/create.*competition|new competition/i).should('be.visible');
  });

  it('closes the dialog when Cancel is clicked', () => {
    cy.contains('button', /new competition|add competition|create/i).click();
    cy.contains(/create.*competition|new competition/i).should('be.visible');
    cy.contains('button', 'Cancel').click();
    cy.get('[role="dialog"][aria-label="Create Competition"]').should('not.exist');
  });

  it('creates a competition and shows a success message', () => {
    const newComp = {
      id: 99,
      name: 'New E2E League',
      competition_type: 'league',
      status: 'upcoming',
      start_date: '2025-09-01',
      end_date: null,
      season_id: null,
      series_id: null,
      settings: { format_config: {} },
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
    };

    cy.intercept('POST', '/api/competitions', { statusCode: 201, body: newComp }).as('createCompetition');
    interceptCompetitionsList([COMPETITION_FIXTURE, TOURNAMENT_FIXTURE, newComp]);

    cy.contains('button', /new competition|add competition|create/i).click();

    cy.get('#competition-name').type('New E2E League');
    cy.get('#competition-type').select('league');
    cy.get('#competition-start').type('2025-09-01');

    cy.contains('[role="dialog"] button', /^Save$/).click();

    cy.wait('@createCompetition');
    cy.contains(/created|success/i).should('be.visible');
  });
});

describe('Competitions: Edit competition', () => {
  beforeEach(() => {
    visitCompetitions();
    cy.wait('@getCompetitions');
  });

  it('opens the edit dialog for an existing competition', () => {
    cy.intercept('PUT', '/api/competitions/*', {
      statusCode: 200,
      body: { ...COMPETITION_FIXTURE, name: 'Updated League' },
    }).as('updateCompetition');

    // Click the first competition's edit/action button
    cy.contains('Spring League 2025')
      .closest('.competition-card')
      .within(() => {
        cy.contains('button', /edit/i).click();
      });

    cy.contains(/edit.*competition|update.*competition/i).should('be.visible');
    cy.contains('button', 'Cancel').click();
  });
});

describe('Competitions: Delete competition', () => {
  beforeEach(() => {
    visitCompetitions();
    cy.wait('@getCompetitions');
  });

  it('prompts for confirmation before deleting', () => {
    cy.intercept('DELETE', '/api/competitions/*', { statusCode: 204 }).as('deleteCompetition');

    const stub = cy.stub();
    cy.on('window:confirm', stub);

    cy.contains('Spring League 2025')
      .closest('.competition-card')
      .within(() => {
        cy.contains('button', /delete|remove/i).click();
      });

    cy.wrap(stub).should('have.been.calledOnce');
  });
});

describe('Competitions: Empty state', () => {
  it('shows an empty state when no competitions exist', () => {
    interceptCompetitionsList([]);
    interceptSeasonsEmpty();
    interceptSeriesEmpty();

    cy.visit('/competitions', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(COACH_USER));
      },
    });

    cy.wait('@getCompetitions');
    cy.contains('Spring League 2025').should('not.exist');
    cy.contains('Cup Finals 2025').should('not.exist');
  });
});

describe('Competitions: Accessibility', () => {
  it('renders competition cards with accessible markup', () => {
    visitCompetitions();
    cy.wait('@getCompetitions');
    // Competition cards or rows should exist
    cy.contains('Spring League 2025').should('be.visible');
    // The page should have a heading
    cy.get('h1, h2').should('exist');
  });

  it('has an accessible create button', () => {
    visitCompetitions();
    cy.wait('@getCompetitions');
    cy.contains('button', /new competition|add competition|create/i).should('be.visible');
  });
});

describe('Competitions: Mobile responsiveness', () => {
  it('displays competitions correctly on mobile viewport', () => {
    cy.viewport('iphone-6');
    visitCompetitions();
    cy.wait('@getCompetitions');
    cy.contains('Spring League 2025').should('be.visible');
  });

  it('displays competitions correctly on tablet viewport', () => {
    cy.viewport('ipad-2');
    visitCompetitions();
    cy.wait('@getCompetitions');
    cy.contains('Spring League 2025').should('be.visible');
  });
});
