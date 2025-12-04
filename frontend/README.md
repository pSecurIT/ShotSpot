# Frontend Development Guide

This document provides essential information for developing the frontend of the ShotSpot application.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Run tests:
   ```bash
   npm test             # Watch mode
   npm run coverage     # With coverage report
   ```

4. Build for production:
   ```bash
   npm run build
   npm run preview     # Preview production build
   ```

## Project Structure

```
frontend/
├── src/               # Application source code
├── public/           # Static assets
├── vite.config.ts    # Vite configuration
├── tsconfig.json     # TypeScript configuration
└── index.html        # Entry point
```

## Testing

### Test Suite Overview
- **Total Tests**: 880 tests across 45 test files
- **Pass Rate**: 100% (880/880 passing) ✅
- **Framework**: Vitest v4.0.15 with @testing-library/react
- **E2E Tests**: Cypress (separate test suite)

### Running Tests
```bash
npm test                 # Run all tests in watch mode
npm test -- --run        # Run all tests once (CI mode)
npm run coverage         # Generate coverage report
npm test -- ComponentName # Run specific test file
```

### Twizzit Integration Tests (54 tests - All Passing ✅)
The Twizzit integration test suite provides comprehensive coverage:
- **TwizzitSettings** (10 tests): Configuration form, API key validation, connection testing, error handling
- **TwizzitSyncControls** (12 tests): Manual sync triggers, status updates, auto-refresh, network errors
- **TwizzitSyncHistory** (14 tests): Sync log viewing, pagination, filtering by type/status, log details
- **TwizzitConflicts** (14 tests): Conflict resolution UI, admin access control, data comparison, ID display

**Key Testing Patterns**:
- Use role-based selectors (`getByRole`, `getAllByRole`) over label-based when labels lack `htmlFor`
- Mock API responses with exact structure: `{ data: { success: true, ...payload } }`
- Pagination uses `offset` (not `page`) with structure: `{ total, offset, limit, hasMore }`
- Avoid fake timers (`vi.useFakeTimers()`) with async React components
- Filter ambiguous text matches by className (e.g., `status-label` vs option elements)
- Use `textContent` for elements with mixed content (emoji + text)

**Common Solutions**:
- Pagination undefined: Component uses defensive checks (`pagination?.offset`, `logs || []`)
- Button text with emojis: Use `textContent.includes()` instead of exact match
- Multiple matches: Filter results by className or parent element to get specific instance

### E2E Tests
```bash
npm run cypress:open     # Open Cypress UI
npm run cypress:run      # Run Cypress headless
```

## Best Practices

- Use TypeScript for type safety
- Follow the feature-based folder structure
- Write tests for all new components
- Keep components small and focused
- Use proper data fetching patterns with axios

## Common Tasks

### Adding a New Component

1. Create a new file in the appropriate feature directory
2. Write the component with TypeScript
3. Add corresponding test file
4. Export from feature's index.ts

### Adding a New Route

1. Add the route in the router configuration
2. Create corresponding component
3. Add loading and error states
4. Test the new route

### Making API Calls

1. Use axios for HTTP requests
2. Handle loading and error states
3. Type the response data
4. Add error boundaries where needed