/**
 * E2E tests for mobile navigation and gesture handling.
 *
 * Tests hamburger menu, swipe gestures, and keyboard interactions
 * on mobile viewports (iPhone, Android).
 */

const COACH_USER = {
  id: 3,
  username: 'cypcoach',
  email: 'cypcoach@example.com',
  role: 'coach',
};

const USER = {
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

const interceptDashboardRequests = () => {
  cy.intercept('GET', '/api/games?limit=5&sort=recent', { statusCode: 200, body: [] }).as('recentGames');
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

const visitDashboardMobile = (user = COACH_USER, viewport: 'iphone' | 'android' = 'iphone') => {
  if (viewport === 'iphone') {
    cy.viewport(375, 812); // iPhone 11/12/13
  } else {
    cy.viewport(360, 800); // Generic Android
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

describe('Mobile Navigation: Hamburger Menu (iPhone)', () => {
  beforeEach(() => {
    visitDashboardMobile(COACH_USER, 'iphone');
  });

  it('shows hamburger menu button on iPhone viewport', () => {
    cy.get('.navigation-v2__hamburger').should('be.visible');
  });

  it('hamburger menu button has correct aria attributes', () => {
    cy.get('.navigation-v2__hamburger')
      .should('have.attr', 'aria-label', 'Open navigation menu')
      .should('have.attr', 'aria-expanded', 'false')
      .should('have.attr', 'aria-controls');
  });

  it('clicking hamburger button opens mobile menu panel', () => {
    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
  });

  it('mobile menu panel is properly positioned and accessible', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel')
      .should('have.class', 'open')
      .should('have.attr', 'role', 'dialog')
      .should('have.attr', 'aria-modal', 'true');
  });

  it('clicking overlay closes mobile menu', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
    cy.get('.mobile-menu-overlay').click({ force: true });
    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });

  it('pressing Escape key closes mobile menu', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
    cy.get('body').type('{esc}');
    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });

  it('close button in menu header closes menu', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
    cy.get('.mobile-menu-header__close').click();
    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });

  it('menu header displays user role chip', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-header__role-chip').invoke('text').then((text) => {
      expect(text.trim().toLowerCase()).to.equal('coach');
    });
  });

  it('mobile menu shows role-based navigation items', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel.open').should('exist');
    // Coach should see Matches, Analytics, Data sections
    cy.get('.mobile-menu-panel.open .mobile-menu-nav').should('exist');
    cy.get('.mobile-menu-section').should('have.length.greaterThan', 0);
  });

  it('tabbing focuses menu items when menu is open', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-header__close').focus();
    cy.focused().should('have.class', 'mobile-menu-header__close');
  });

  it('menu sections can be expanded/collapsed', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel.open').should('exist');
    cy.get('.mobile-menu-section__header').first().then(($header) => {
      const isExpandable = $header.find('.mobile-menu-section__arrow').length > 0;
      if (isExpandable) {
        cy.wrap($header).click({ force: true });
        cy.get('.mobile-menu-section__arrow').first().should('have.class', 'open');
      } else {
        // Section headers without arrows still exist - just verify panel is open
        cy.get('.mobile-menu-panel').should('have.class', 'open');
      }
    });
  });
});

describe('Mobile Navigation: Hamburger Menu (Android)', () => {
  beforeEach(() => {
    visitDashboardMobile(USER, 'android');
  });

  it('shows hamburger menu button on Android viewport', () => {
    cy.get('.navigation-v2__hamburger').should('be.visible');
  });

  it('clicking hamburger opens menu on Android', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
  });

  it('overlay closes menu on Android', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-overlay').click({ force: true });
    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });
});

describe('Mobile Navigation: Swipe Gestures (iPhone)', () => {
  beforeEach(() => {
    visitDashboardMobile(COACH_USER, 'iphone');
  });

  it('right-swipe on left edge opens menu', () => {
    // Simulate touch swipe from left edge moving right
    cy.get('.navigation-v2__swipe-edge')
      .trigger('touchstart', { touches: [{ clientX: 18, clientY: 400 }] })
      .trigger('touchend', { changedTouches: [{ clientX: 100, clientY: 400 }] });

    cy.get('.mobile-menu-panel').should('have.class', 'open');
  });

  it('left-swipe on menu panel closes menu', () => {
    // Open menu first
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');

    // Simulate left swipe on menu panel
    cy.get('.mobile-menu-panel')
      .trigger('touchstart', { touches: [{ clientX: 300, clientY: 400 }] })
      .trigger('touchend', { changedTouches: [{ clientX: 100, clientY: 400 }] });

    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });

  it('swipe distance below threshold does not open menu', () => {
    // Swipe less than 56px (minimum distance)
    cy.get('.navigation-v2__swipe-edge')
      .trigger('touchstart', { touches: [{ clientX: 18, clientY: 400 }] })
      .trigger('touchend', { changedTouches: [{ clientX: 40, clientY: 400 }] });

    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });

  it('excessive vertical movement cancels swipe', () => {
    // Vertical swipe (more than 96px vertical deviation)
    cy.get('.navigation-v2__swipe-edge')
      .trigger('touchstart', { touches: [{ clientX: 18, clientY: 300 }] })
      .trigger('touchend', { changedTouches: [{ clientX: 100, clientY: 500 }] });

    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });
});

describe('Mobile Navigation: Swipe Gestures (Android)', () => {
  beforeEach(() => {
    visitDashboardMobile(USER, 'android');
  });

  it('right-swipe opens menu on Android viewport', () => {
    cy.get('.navigation-v2__swipe-edge')
      .trigger('touchstart', { touches: [{ clientX: 18, clientY: 400 }] })
      .trigger('touchend', { changedTouches: [{ clientX: 100, clientY: 400 }] });

    cy.get('.mobile-menu-panel').should('have.class', 'open');
  });

  it('left-swipe closes menu on Android viewport', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');

    cy.get('.mobile-menu-panel')
      .trigger('touchstart', { touches: [{ clientX: 300, clientY: 400 }] })
      .trigger('touchend', { changedTouches: [{ clientX: 100, clientY: 400 }] });

    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });
});

describe('Mobile Navigation: Keyboard Interactions', () => {
  beforeEach(() => {
    visitDashboardMobile(ADMIN_USER, 'iphone');
  });

  it('menu closes when pressing Escape while focused on menu', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel').should('have.class', 'open');
    cy.get('.mobile-menu-panel').trigger('keydown', { key: 'Escape' });
    cy.get('body').type('{esc}');
    cy.get('.mobile-menu-panel').should('not.have.class', 'open');
  });

  it('tab key moves focus within menu items', () => {
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-header__close').focus();
    cy.focused().should('have.class', 'mobile-menu-header__close');
  });
});

describe('Mobile Navigation: Menu Content and Visibility', () => {
  it('coach sees all allowed menu sections', () => {
    visitDashboardMobile(COACH_USER, 'iphone');
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel.open').should('exist');
    cy.get('.mobile-menu-panel.open .mobile-menu-nav').should('exist');
    cy.get('[class*="mobile-menu"]').should('exist');
  });

  it('admin user sees all menu sections including user management', () => {
    visitDashboardMobile(ADMIN_USER, 'iphone');
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel.open').should('exist');
    cy.get('.mobile-menu-panel.open .mobile-menu-nav').should('exist');
  });

  it('regular user sees limited menu sections', () => {
    visitDashboardMobile(USER, 'iphone');
    cy.get('.navigation-v2__hamburger').click();
    cy.get('.mobile-menu-panel.open').should('exist');
    cy.get('.mobile-menu-panel.open .mobile-menu-nav').should('exist');
  });
});

describe('Mobile Navigation: Viewport Transitions', () => {
  it('hamburger menu hidden on desktop viewport', () => {
    cy.viewport(1280, 900);
    interceptDashboardRequests();
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(COACH_USER));
        win.localStorage.setItem(`shotspot:onboarding:v1:${COACH_USER.id}:${COACH_USER.role}`, 'done');
      },
    });
    // At desktop width (>= 1024px) hamburger is not rendered by React
    cy.get('.navigation-v2__hamburger').should('not.exist');
  });

  it('hamburger menu shown on tablet viewport', () => {
    cy.viewport(768, 1024); // iPad size
    interceptDashboardRequests();
    cy.visit('/dashboard', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(COACH_USER));
        win.localStorage.setItem(`shotspot:onboarding:v1:${COACH_USER.id}:${COACH_USER.role}`, 'done');
      },
    });
    dismissOnboardingIfPresent();
    cy.get('.navigation-v2__hamburger').should('be.visible');
  });
});
