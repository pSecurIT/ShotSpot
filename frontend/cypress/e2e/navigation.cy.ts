/**
 * E2E tests for application navigation flows.
 *
 * These tests assume the dev server is running on http://localhost:3000
 * and a valid user account exists (seeded via setup-db or test fixtures).
 */

const AUTH_USER = {
  id: 1,
  username: 'cypress',
  email: 'cypress@example.com',
  role: 'user',
};

const ADMIN_USER = {
  id: 2,
  username: 'cypadmin',
  email: 'cypadmin@example.com',
  role: 'admin',
};

const COACH_USER = {
  id: 3,
  username: 'cypcoach',
  email: 'cypcoach@example.com',
  role: 'coach',
};

/** Inject a fake JWT token + user object so the app treats the visitor as logged in. */
const loginAs = (user: typeof AUTH_USER) => {
  cy.window().then((win) => {
    win.localStorage.setItem('token', 'cypress-token');
    win.localStorage.setItem('user', JSON.stringify(user));
  });
};

describe('Navigation: Unauthenticated', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('redirects the root path to /login when unauthenticated', () => {
    cy.url().should('include', '/login');
  });

  it('shows Login and Register links', () => {
    cy.visit('/login');
    cy.contains('a', 'Login').should('be.visible');
    cy.contains('a', 'Register').should('be.visible');
  });

  it('does not show the main navigation menu', () => {
    cy.visit('/login');
    cy.get('[aria-label="Main navigation"]').should('exist');
    cy.contains('Dashboard').should('not.exist');
  });
});

describe('Navigation: Authenticated user', () => {
  beforeEach(() => {
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(AUTH_USER));
      },
    });
  });

  it('shows the Dashboard link in navigation', () => {
    cy.contains('Dashboard').should('be.visible');
  });

  it('shows the Matches nav group', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Matches').should('be.visible');
  });

  it('shows the Analytics nav group', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Analytics').should('be.visible');
  });

  it('shows the User menu button', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'User').should('be.visible');
  });

  it('does not show the Settings (admin-only) nav group', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').should('not.exist');
  });

  it('can open and close the Matches dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Matches').click();
    cy.contains('Games').should('be.visible');
    cy.get('body').type('{esc}');
  });

  it('can open the Analytics dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Analytics').click();
    cy.contains('Advanced Analytics').should('be.visible');
  });

  it('can open the User menu and see Change Password option', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'User').click();
    cy.contains('Change Password').should('be.visible');
  });

  it('can open and close the Change Password dialog', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'User').click();
    cy.contains('Change Password').first().click();
    cy.contains('Change Your Password').should('be.visible');
    cy.contains('button', 'Cancel').click();
    cy.contains('Change Your Password').should('not.exist');
  });

  it('navigates to /profile when My Profile is clicked', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'User').click();
    cy.contains('My Profile').first().click();
    cy.url().should('include', '/profile');
  });

  it('navigates to /my-achievements when My Achievements is clicked', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'User').click();
    cy.contains('My Achievements').first().click();
    cy.url().should('include', '/my-achievements');
  });

  it('logs out and redirects to /login', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'User').click();
    cy.contains('Logout').first().click();
    cy.url().should('include', '/login');
    cy.window().its('localStorage').invoke('getItem', 'token').should('be.null');
  });
});

describe('Navigation: Coach user', () => {
  beforeEach(() => {
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(COACH_USER));
      },
    });
  });

  it('shows Match Templates in the Matches dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Matches').click();
    cy.contains('Match Templates').should('be.visible');
  });

  it('shows Settings nav group for coaches', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').should('be.visible');
  });

  it('shows Twizzit Integration in Settings for coaches', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').click();
    cy.contains('Twizzit Integration').should('be.visible');
  });
});

describe('Navigation: Admin user', () => {
  beforeEach(() => {
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(ADMIN_USER));
      },
    });
  });

  it('shows the Settings nav group', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').should('be.visible');
  });

  it('shows User Management in Settings for admins', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').click();
    cy.contains('User Management').should('be.visible');
  });

  it('shows Twizzit Integration in Settings for admins', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').click();
    cy.contains('Twizzit Integration').should('be.visible');
  });
});

describe('Navigation: Protected routes redirect', () => {
  it('redirects /dashboard to /login when not authenticated', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  it('redirects /competitions to /login when not authenticated', () => {
    cy.visit('/competitions');
    cy.url().should('include', '/login');
  });
});

describe('Navigation: Route transitions', () => {
  beforeEach(() => {
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(AUTH_USER));
      },
    });
  });

  it('navigates to Games via Matches dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Matches').click();
    cy.contains('a', 'Games').click();
    cy.url().should('include', '/games');
  });

  it('navigates to Competitions via the Data dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Data').click();
    cy.contains('a', 'Competitions').click();
    cy.url().should('include', '/competitions');
  });

  it('navigates back to Dashboard by clicking the Dashboard link', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Data').click();
    cy.contains('a', 'Competitions').click();
    cy.url().should('include', '/competitions');

    cy.contains('a', 'Dashboard').first().click();
    cy.url().should('include', '/dashboard');
  });

  it('shows a 404 page for an unknown route', () => {
    cy.visit('/this-route-does-not-exist');
    cy.contains(/not found|404/i).should('be.visible');
  });
});

describe('Navigation: Mobile responsiveness', () => {
  beforeEach(() => {
    cy.viewport('iphone-6');
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(AUTH_USER));
      },
    });
  });

  it('renders the navigation bar on mobile viewport', () => {
    cy.get('[aria-label="Main navigation"]').should('exist');
  });

  it('shows a hamburger/menu toggle on mobile', () => {
    cy.get('[aria-label="Main navigation"]').find('button').should('exist');
  });
});
