# Accessibility Audit and Improvements (Issue #244)

Date: 2026-05-03
Scope: Navigation, dropdown menus, mobile menu, onboarding/help dialogs
Standard: WCAG 2.1 AA (target)

## Acceptance Criteria Coverage

1. Keyboard navigation for all interactive elements
- Implemented for desktop dropdown trigger and menu items (ArrowDown, ArrowUp, Home, End, Escape).
- Mobile menu already supports keyboard focus loop and Escape close behavior.

2. Screen reader compatibility (NVDA/JAWS)
- Improved ARIA labeling for mobile menu and navigation dialogs.
- Decorative icons are hidden from assistive technology via aria-hidden.
- Manual NVDA/JAWS verification is still required outside this environment.

3. Proper ARIA labels and roles
- Added/strengthened aria-label, aria-controls, aria-expanded, aria-describedby and dialog semantics.
- Added explicit mobile section control relationships for collapsible groups.

4. Focus management in modals/dropdowns
- Onboarding and Help dialogs now use the shared accessible dialog hook.
- Initial focus is set predictably, Escape closes dialog, and focus is restored.
- Dropdown closes on focus leave and Escape.

5. Color contrast compliance (4.5:1 minimum)
- Increased low-contrast helper text in navigation and mobile menu headers.

6. Skip navigation link
- Already present and unchanged in app shell.

7. Semantic HTML structure
- Navigation remains inside semantic nav landmarks with clearer labels.

8. Form labels and error announcements
- Existing app already includes labeled inputs and role=alert/aria-live in major forms/dialogs.
- No regressions introduced by this issue.

9. Alt text for all images
- Existing navigation/app shell logo and court images include alt text.
- No navigation regressions introduced by this issue.

10. No keyboard traps
- Dialog focus loops are intentional and escapable (Escape and close actions).
- Mobile menu trap remains bounded and closable via Escape/Close/overlay.

## Test Evidence

- Navigation tests: frontend/src/test/Navigation.test.tsx
- Mobile menu tests: frontend/src/test/MobileMenu.test.tsx

Targeted run command:
- npm run test:run -- src/test/Navigation.test.tsx src/test/MobileMenu.test.tsx

Result:
- 2 test files passed
- 45 tests passed

## Manual Verification Steps (Recommended)

1. Run axe DevTools on dashboard and navigation-open states.
2. Run WAVE on dashboard and at least one form-heavy page.
3. Run Lighthouse Accessibility report for desktop and mobile viewport.
4. Validate with NVDA (Windows) and JAWS for:
   - Navigation landmark discovery
   - Dropdown/menu announcements
   - Dialog title/description and focus restoration
   - Escape behavior and no keyboard traps
