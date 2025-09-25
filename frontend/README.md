# Frontend Development Guide

This document provides essential information for developing the frontend of the Korfball Game Statistics application.

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

- Unit Tests: Vitest with React Testing Library
- E2E Tests: Cypress
- Run E2E tests: `npm run cypress:open` or `npm run cypress:run`

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