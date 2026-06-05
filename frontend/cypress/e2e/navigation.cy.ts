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

const interceptDashboardRequests = () => {
  cy.intercept('GET', '/api/games?limit=5&sort=recent', { statusCode: 200, body: [] }).as('recentGames');
  cy.intercept('GET', '/api/games?limit=20&sort=recent', { statusCode: 200, body: [] }).as('recentGamesLarge');
  cy.intercept('GET', '/api/games?status=upcoming', { statusCode: 200, body: [] }).as('upcomingGames');
  cy.intercept('GET', '/api/achievements/recent?limit=8', { statusCode: 200, body: [] }).as('recentAchievements');
  cy.intercept('GET', '/api/dashboard/summary', { statusCode: 200, body: { teams: 0, players: 0, games: 0 } }).as('dashboardSummary');
  cy.intercept('GET', '/api/clubs/*/theme', { statusCode: 200, body: { theme: null } }).as('clubTheme');
  cy.intercept('GET', '/api/teams/*/theme', { statusCode: 200, body: { theme: null } }).as('teamTheme');
  cy.intercept('/api/ux-observability/events', { statusCode: 204, body: {} }).as('uxEvents');
};

const dismissOnboardingIfPresent = () => {
  cy.get('body').then(($body) => {
    const onboardingDialog = $body.find('.onboarding-dialog');
    if (onboardingDialog.length > 0) {
      cy.contains('button', 'Skip for now').click({ force: true });
      cy.get('.onboarding-dialog').should('not.exist');
    }
  });
};

const visitDashboard = (user: typeof AUTH_USER, viewport: 'desktop' | 'mobile' | 'android' = 'desktop') => {
  if (viewport === 'mobile') {
    cy.viewport('iphone-6');
  } else if (viewport === 'android') {
    cy.viewport(360, 800);
  } else {
    cy.viewport(1280, 900);
  }

  interceptDashboardRequests();

  cy.visit('/dashboard', {
    onBeforeLoad: (win) => {
      win.localStorage.setItem('token', 'cypress-token');
      win.localStorage.setItem('user', JSON.stringify(user));
      win.localStorage.setItem(`shotspot:onboarding:v1:${user.id}:${user.role}`, 'done');
    },
  });

  dismissOnboardingIfPresent();
};

describe('Navigation: Unauthenticated', () => {
  beforeEach(() => {
    cy.viewport(1280, 900);
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
    visitDashboard(AUTH_USER);
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

  it('shows the Settings nav group', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Settings').should('be.visible');
  });

  it('can open and close the Matches dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Matches').click();
    cy.contains('Games').should('be.visible');
    cy.get('body').type('{esc}');
  });

  it('can open the Analytics dropdown', () => {
    cy.get('[aria-label="Main navigation"]').contains('button', 'Analytics').click();
    cy.contains('Achievements').should('be.visible');
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
    visitDashboard(COACH_USER);
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
    visitDashboard(ADMIN_USER);
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
    cy.viewport(1280, 900);
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
  });

  it('redirects /competitions to /login when not authenticated', () => {
    cy.viewport(1280, 900);
    cy.visit('/competitions');
    cy.url().should('include', '/login');
  });
});

describe('Navigation: Route transitions', () => {
  beforeEach(() => {
    visitDashboard(COACH_USER);
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
    visitDashboard(AUTH_USER, 'mobile');
  });

  it('renders the navigation bar on mobile viewport', () => {
    cy.get('[aria-label="Main navigation"]').should('exist');
  });

  it('shows a hamburger/menu toggle on mobile', () => {
    cy.get('[aria-label="Main navigation"]').find('button').should('exist');
  });

  it('enables safe-area support for notched devices', () => {
    cy.get('meta[name="viewport"]')
      .should('have.attr', 'content')
      .and('include', 'viewport-fit=cover');

    cy.window().then((win) => {
      const safeAreaTop = win
        .getComputedStyle(win.document.documentElement)
        .getPropertyValue('--safe-area-top')
        .trim();

      expect(safeAreaTop.length).to.be.greaterThan(0);
    });
  });

  it('opens menu when swiping from the left edge and closes on panel swipe', () => {
    cy.get('.navigation-v2__swipe-edge')
      .trigger('touchstart', {
        touches: [{ clientX: 6, clientY: 140 }],
      })
      .trigger('touchend', {
        changedTouches: [{ clientX: 88, clientY: 146 }],
      });

    cy.get('.mobile-menu-panel').should('have.class', 'open');

    cy.get('.mobile-menu-panel')
      .trigger('touchstart', {
        touches: [{ clientX: 280, clientY: 160 }],
      })
      .trigger('touchend', {
        changedTouches: [{ clientX: 190, clientY: 164 }],
      });

    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });
});

describe('Navigation: Android viewport behavior', () => {
  beforeEach(() => {
    visitDashboard(AUTH_USER, 'android');
  });

  it('shows mobile navigation controls on Android-sized viewport', () => {
    cy.get('[aria-label="Main navigation"]').should('exist');
    cy.get('.navigation-v2__hamburger').should('be.visible');
  });
});

describe('Navigation: Offline mobile behavior', () => {
  beforeEach(() => {
    cy.viewport('iphone-6');
    cy.intercept('GET', '/api/games?limit=5&sort=recent', { statusCode: 503, body: { error: 'Offline' } });
    cy.intercept('GET', '/api/games?status=upcoming', { statusCode: 503, body: { error: 'Offline' } });
    cy.intercept('GET', '/api/achievements/recent?limit=8', { statusCode: 503, body: { error: 'Offline' } });
    cy.intercept('GET', '/api/dashboard/summary', { statusCode: 503, body: { error: 'Offline' } });

    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(AUTH_USER));
        win.localStorage.setItem(`shotspot:onboarding:v1:${AUTH_USER.id}:${AUTH_USER.role}`, 'done');
      },
    });
  });

  it('keeps mobile navigation interactive when dashboard API calls fail', () => {
    cy.get('.navigation-v2__hamburger').should('be.visible').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
  });
});

describe('Navigation: Screen-size matrix', () => {
  const matrix = [
    { width: 360, height: 740, expectMobile: true },
    { width: 390, height: 844, expectMobile: true },
    { width: 768, height: 1024, expectMobile: true },
    { width: 1280, height: 900, expectMobile: false },
  ];

  matrix.forEach((entry) => {
    it(`renders expected nav controls at ${entry.width}x${entry.height}`, () => {
      cy.viewport(entry.width, entry.height);
      interceptDashboardRequests();

      cy.visit('/dashboard', {
        onBeforeLoad: (win) => {
          win.localStorage.setItem('token', 'cypress-token');
          win.localStorage.setItem('user', JSON.stringify(AUTH_USER));
          win.localStorage.setItem(`shotspot:onboarding:v1:${AUTH_USER.id}:${AUTH_USER.role}`, 'done');
        },
      });

      cy.get('[aria-label="Main navigation"]').should('exist');

      if (entry.expectMobile) {
        cy.get('body').then(($body) => {
          const hasVisibleHamburger = $body.find('.navigation-v2__hamburger:visible').length > 0;
          const hasVisibleUtility = $body.find('.navigation-v2__utility:visible').length > 0;
          expect(hasVisibleHamburger || hasVisibleUtility).to.eq(true);
        });
      } else {
        cy.get('.navigation-v2__desktop').should('be.visible');
      }
    });
  });
});

export {};
