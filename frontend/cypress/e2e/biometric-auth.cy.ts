/**
 * E2E tests for biometric authentication flows (Issue #560).
 *
 * These tests emulate a native Capacitor runtime in-browser by mocking
 * BiometricAuth and SecureStorage plugins on window.Capacitor.Plugins.
 */

type MockUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

const AUTH_USER: MockUser = {
  id: 7,
  username: 'bio-user',
  email: 'bio-user@example.com',
  role: 'coach',
};

const AUTH_TOKEN = 'bio-token-123';

type BiometricScenario = 'success' | 'cancel' | 'fail' | 'locked';

type NativeMockOptions = {
  scenario?: BiometricScenario;
  preEnrolled?: boolean;
  forceOffline?: boolean;
};

const interceptDashboardRequests = () => {
  cy.intercept('GET', '/api/games?limit=5&sort=recent', { statusCode: 200, body: [] }).as('recentGames');
  cy.intercept('GET', '/api/games?status=upcoming', { statusCode: 200, body: [] }).as('upcomingGames');
  cy.intercept('GET', '/api/achievements/recent?limit=8', { statusCode: 200, body: [] }).as('recentAchievements');
  cy.intercept('GET', '/api/dashboard/summary', { statusCode: 200, body: { teams: 0, players: 0, games: 0 } }).as('dashboardSummary');
  cy.intercept('GET', '/api/clubs/*/theme', { statusCode: 200, body: { theme: null } }).as('clubTheme');
  cy.intercept('GET', '/api/teams/*/theme', { statusCode: 200, body: { theme: null } }).as('teamTheme');
  cy.intercept('POST', '/api/ux-observability/events', { statusCode: 204, body: {} }).as('uxEvents');
};

const seedSessionStorage = (win: Window, user = AUTH_USER, token = AUTH_TOKEN) => {
  win.localStorage.setItem('token', token);
  win.localStorage.setItem('user', JSON.stringify(user));
  win.localStorage.setItem(`shotspot:onboarding:v1:${user.id}:${user.role}`, 'done');
};

const installNativeBiometricMocks = (win: Window, options: NativeMockOptions = {}) => {
  const scenario = options.scenario ?? 'success';

  const mockState: {
    available: boolean;
    enrolled: boolean;
    scenario: BiometricScenario;
    store: Record<string, string>;
  } = {
    available: true,
    enrolled: !!options.preEnrolled,
    scenario,
    store: {},
  };

  if (options.preEnrolled) {
    mockState.store.bio_token = AUTH_TOKEN;
    mockState.store.bio_user = JSON.stringify(AUTH_USER);
    mockState.store.bio_enrolled = 'true';
  }

  (win as unknown as { __bioStore: Record<string, string> }).__bioStore = mockState.store;
  (
    win as unknown as {
      __SHOTSPOT_BIOMETRIC_MOCK: {
        available: boolean;
        enrolled: boolean;
        scenario: BiometricScenario;
        store: Record<string, string>;
      };
    }
  ).__SHOTSPOT_BIOMETRIC_MOCK = mockState;

  if (options.forceOffline) {
    Object.defineProperty(win.navigator, 'onLine', {
      value: false,
      configurable: true,
    });
  }

};

const dismissOnboardingIfPresent = () => {
  cy.get('body').then(($body) => {
    if ($body.find('.onboarding-dialog').length > 0) {
      cy.contains('button', 'Skip for now').click({ force: true });
      cy.get('.onboarding-dialog').should('not.exist');
    }
  });
};

describe('Biometric Auth Flows', () => {
  it('enrolls biometric auth after successful password login', () => {
    interceptDashboardRequests();

    cy.intercept('GET', '/api/auth/csrf', {
      statusCode: 200,
      body: { csrfToken: 'csrf-token' },
    }).as('csrf');

    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        token: AUTH_TOKEN,
        user: AUTH_USER,
      },
    }).as('passwordLogin');

    cy.visit('/login', {
      onBeforeLoad: (win) => {
        installNativeBiometricMocks(win, { preEnrolled: false, scenario: 'success' });
      },
    });

    cy.get('input#username').type(AUTH_USER.username);
    cy.get('input#password').type('Password!123');
    cy.contains('button', 'Login').click();

    cy.wait('@csrf');
    cy.wait('@passwordLogin');

    cy.contains('h2', 'Enable biometric login?').should('be.visible');
    cy.contains('button', 'Enable biometric login').scrollIntoView().click({ force: true });

    cy.url().should('include', '/dashboard');
    dismissOnboardingIfPresent();

    cy.window().then((win) => {
      const store = (win as unknown as { __bioStore: Record<string, string> }).__bioStore;
      expect(store.bio_enrolled).to.eq('true');
      expect(store.bio_token).to.eq(AUTH_TOKEN);
      expect(store.bio_user).to.eq(JSON.stringify(AUTH_USER));
    });
  });

  it('quick-unlocks with biometrics on app relaunch when enrolled', () => {
    interceptDashboardRequests();

    cy.visit('/login', {
      onBeforeLoad: (win) => {
        installNativeBiometricMocks(win, { preEnrolled: true, scenario: 'success' });
      },
    });

    cy.get('button[aria-label="Sign in with biometrics"]').should('be.visible').click();

    cy.url().should('include', '/dashboard');
    dismissOnboardingIfPresent();
    cy.window().its('localStorage').invoke('getItem', 'token').should('eq', AUTH_TOKEN);
  });

  it('falls back to password when biometric auth is cancelled', () => {
    cy.visit('/login', {
      onBeforeLoad: (win) => {
        installNativeBiometricMocks(win, { preEnrolled: true, scenario: 'cancel' });
      },
    });

    cy.get('button[aria-label="Sign in with biometrics"]').should('be.visible').click();

    cy.contains('Biometric authentication was cancelled.').should('be.visible');
    cy.get('input#username').should('be.visible');
    cy.get('input#password').should('be.visible');
  });

  it('disables and resets biometric enrollment from Settings > Security', () => {
    interceptDashboardRequests();

    cy.visit('/settings', {
      onBeforeLoad: (win) => {
        installNativeBiometricMocks(win, { preEnrolled: true, scenario: 'success' });
        seedSessionStorage(win);
      },
    });

    cy.contains('button', 'Security').click();
    cy.contains('h3', 'Biometric login').should('be.visible');
    cy.contains('button', 'Disable biometric login').click();
    cy.contains('Biometric login has been disabled').should('be.visible');

    cy.window().then((win) => {
      const store = (win as unknown as { __bioStore: Record<string, string> }).__bioStore;
      expect(store.bio_enrolled).to.be.undefined;
      expect(store.bio_token).to.be.undefined;
      expect(store.bio_user).to.be.undefined;
    });
  });

  it('biometric unlock works while offline with cached session continuity', () => {
    interceptDashboardRequests();

    cy.visit('/login', {
      onBeforeLoad: (win) => {
        installNativeBiometricMocks(win, {
          preEnrolled: true,
          scenario: 'success',
          forceOffline: true,
        });
      },
    });

    cy.get('button[aria-label="Sign in with biometrics"]').should('be.visible').click();

    cy.url().should('include', '/dashboard');
    dismissOnboardingIfPresent();

    // Cached session remains active even when browser reports offline.
    cy.window().its('localStorage').invoke('getItem', 'token').should('eq', AUTH_TOKEN);
    cy.window().then((win) => {
      expect(win.navigator.onLine).to.eq(false);
    });
  });
});
