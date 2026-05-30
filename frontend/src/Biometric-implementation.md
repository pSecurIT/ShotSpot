**## Plan: Biometric Quick Login (Issue 560)

Implement native biometric quick login for iOS and Android by adding secure token storage + biometric unlock in the frontend auth layer, while keeping password login as a reliable fallback. The plan preserves offline-first behavior so users can unlock and continue queued actions with cached role/session context.

### Decisions captured from your answers
1. Token model: biometric unlock of a securely stored token.
2. Platform scope: iOS native and Android native.
3. Enrollment UX: prompt after password login and manage/reset in settings.
4. Session policy: no forced periodic password re-entry; biometrics remain valid until logout.
5. Offline behavior: keep cached role access and allow queued write actions offline.

### Steps
1. Define biometric auth contract in auth layer: availability check, enroll, authenticate, disable/reset, and fallback states.
2. Integrate Capacitor biometric + secure storage plugins and add platform prerequisites for iOS and Android.
3. Extend [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx) with biometric methods and state transitions.
4. Update [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx) for quick-login CTA, post-login enrollment prompt, and explicit fallback messaging.
5. Add settings controls for opt-out/reset with clear UX copy.
6. Ensure [frontend/src/utils/api.ts](frontend/src/utils/api.ts) token initialization/interceptors work with secure-storage sourced tokens.
7. Preserve offline queue behavior after biometric unlock and define handling for expired/invalid stored tokens (online vs offline).
8. Validate iOS Face ID/Touch ID and Android fingerprint behavior across supported devices.
9. Add unit/integration tests for biometric service, AuthContext transitions, login fallback flows, and storage/session edge cases.
10. Add Cypress flows for enrollment, relaunch unlock, failure/cancel fallback, reset, and offline queued-write continuity.
11. Update mobile/security docs and add rollout QA checklist.

### Relevant files
1. [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx)
2. [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx)
3. [frontend/src/utils/api.ts](frontend/src/utils/api.ts)
4. [frontend/src/main.tsx](frontend/src/main.tsx)
5. [frontend/capacitor.config.ts](frontend/capacitor.config.ts)
6. [frontend/package.json](frontend/package.json)
7. [frontend/src/test/AuthContext.test.tsx](frontend/src/test/AuthContext.test.tsx)
8. [frontend/src/test/Login.test.tsx](frontend/src/test/Login.test.tsx)
9. [frontend/src/test/api.test.ts](frontend/src/test/api.test.ts)
10. [frontend/cypress/e2e](frontend/cypress/e2e)
11. [MOBILE.md](MOBILE.md)
12. [MOBILE_ARCHITECTURE.md](MOBILE_ARCHITECTURE.md)

### Verification
1. Run frontend tests with coverage: npm --prefix frontend run coverage
2. Run backend unit auth regression checks: npm --prefix backend run test:unit
3. Run Cypress suite including biometric mocks: npm --prefix frontend run cypress:run
4. Manual iOS validation: enroll, relaunch unlock, fallback, disable/reset, offline unlock, queued write + resync.
5. Manual Android validation: enroll, relaunch unlock, fallback, disable/reset, offline unlock, queued write + resync.
6. Run lint and confirm required PR checks pass.

### Scope boundaries
1. Included: native biometric quick login, secure local token storage, fallback UX, settings reset controls, robust testing.
2. Excluded: web biometric auth, PIN fallback, backend auth redesign/refresh-token overhaul, new dedicated backend biometric endpoints unless later required.
3. Out of scope: enterprise SSO integration, multi-factor auth flows, biometric enrollment on other devices (e.g., desktop), advanced session management policies (e.g., forced re-auth after inactivity).