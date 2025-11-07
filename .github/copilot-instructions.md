# Copilot Instructions for ShotSpot - a Korfball game statistics app

## Project Overview
This app tracks real-time statistics for korfball matches, focusing on shot locations, outcomes (goal/miss), player management, and game events (faults, time tracking).

## Architecture & Key Components
- **Player & Team Management**: Users input team rosters and bench players before the match.
- **Match Event Tracking**: During the game, the app records:
  - Shot locations and results (goal, miss, hit but no score)
  - Faults (out of bounds, defensive/offensive)
  - Game time
- **User Roles**: Primarily designed for coaches and assistants.

## Developer Workflows
### Build & Development
- **Frontend Development**:
  - Start dev server: `npm run dev`
  - Build for production: `npm run build`
  - Preview production build: `npm run preview`
- **Project Structure**:
  - `src/` - Application source code
  - `public/` - Static assets
  - `vite.config.ts` - Vite configuration
  - `tsconfig.json` - TypeScript configuration

### Testing Guidelines
- **Unit Tests**: Use Vitest for frontend and Jest for backend
  - Frontend: Test React components with `@testing-library/react`
  - Run tests: `npm test` (watch mode) or `npm run coverage` (with coverage report)
  - Backend: Test API endpoints with `supertest`
- **Integration Tests**:
  - Use Cypress for end-to-end testing of critical flows
  - Key test scenarios:
    - Team/player management workflow
    - Match event recording
    - Real-time updates
- **Test Coverage Requirements**:
  - **NEW FUNCTIONALITY**: All newly created functionalities MUST achieve minimum 80% test coverage before being considered complete
  - Maintain minimum 80% coverage for existing business logic
  - All API endpoints must have comprehensive integration tests
  - Critical UI flows must have E2E tests
  - Security-critical modules (authentication, user management, data validation) require 90%+ coverage
  - Use comprehensive test scenarios including positive cases, negative cases, edge cases, and error handling

### Security Requirements
- **Authentication & Authorization**:
  - Implement JWT-based authentication
  - Role-based access control (Coach, Assistant, Viewer)
  - Secure password hashing with bcrypt
- **Data Protection**:
  - Input validation on all API endpoints
  - Sanitize SQL queries using parameterized statements
  - HTTPS required for all API communications
- **API Security**:
  - Rate limiting on all endpoints
  - CORS configuration for frontend origin only
  - Request size limits to prevent DoS
- **Auditing**:
  - Log all data modifications with user context
  - Track failed authentication attempts
  - Regular security audit of dependencies

## Project-Specific Patterns
- **Real-time Data Entry**: UI/logic should prioritize speed and accuracy for live match input.
- **Event Granularity**: Each shot and fault is tracked with location/context, not just summary stats.
- **Player State**: Track which players are active vs. on the bench throughout the match.

## Integration Points
- **Database**: PostgreSQL with secure connection strings in environment variables
- **API Authentication**: JWT tokens with refresh mechanism
- **Real-time Updates**: WebSocket connections with secure handshake

## Conventions
- **Naming**: Use clear, descriptive names for events, players, and UI elements (e.g., `shotLocation`, `playerStatus`).
- **File Organization**: Place future source code in folders by feature (e.g., `src/players/`, `src/match/`).
- **Documentation**: Update this file and the README with any new workflows or conventions.
- **Testing Standards**: 
  - Write tests BEFORE or ALONGSIDE new functionality implementation
  - All new routes, components, and business logic must include comprehensive test suites
  - Test files should follow naming convention: `filename.test.js` or `filename.spec.js`
  - Include test descriptions with emojis for better readability (✅ success cases, ❌ error cases, 🔧 edge cases)
- **Security**: 
  - Prefix security-sensitive variables with `secure`
  - Document all security-relevant configuration
  - Include security considerations in code reviews

## Examples
- When adding a new event type, ensure it includes location, player, and result fields.
- UI forms for team setup should allow quick editing and validation.
- Example test structure with comprehensive coverage:
  ```typescript
  describe('👥 User Management API', () => {
    describe('✅ Successful Operations', () => {
      it('✅ should create user with valid data', () => {
        // Test implementation with positive case
      });
      it('✅ should update user role as admin', () => {
        // Test implementation with authorization
      });
    });
    
    describe('❌ Error Handling', () => {
      it('❌ should reject invalid email format', () => {
        // Test implementation with validation
      });
      it('❌ should deny access to non-admin users', () => {
        // Test implementation with security
      });
    });
    
    describe('🔧 Edge Cases', () => {
      it('🔧 should handle database connection errors', () => {
        // Test implementation with error scenarios
      });
    });
  });
  ```
- Security implementation example:
  ```typescript
  // Input validation
  const validateTeamInput = (team: TeamInput): boolean => {
    if (!team.name || team.name.length < 3) {
      throw new ValidationError('Team name must be at least 3 characters');
    }
    return true;
  };

  // Secure database query
  const createTeam = async (team: TeamInput, userId: string): Promise<Team> => {
    validateTeamInput(team);
    const query = 'INSERT INTO teams (name, created_by) VALUES ($1, $2) RETURNING *';
    return db.query(query, [team.name, userId]);
  };
  ```
- Test coverage implementation example:
  ```typescript
  describe('🔐 Security Tests', () => {
    it('✅ should validate input sanitization', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '<script>alert("xss")</script>' })
        .expect(400);
      
      expect(response.body).toHaveProperty('errors');
      // Verify XSS attempt was blocked
    });
    
    it('❌ should require authentication for protected routes', async () => {
      await request(app)
        .get('/api/teams')
        .expect(401);
    });
    
    it('🔧 should handle concurrent user operations safely', async () => {
      // Test concurrent access patterns
      const promises = Array.from({ length: 10 }, () => 
        request(app).post('/api/teams').set('Authorization', token).send(validTeam)
      );
      const results = await Promise.allSettled(promises);
      // Verify no race conditions or data corruption
    });
  });
  ```

---
If any section is unclear or missing, please provide feedback so this guide can be improved for future AI agents.
