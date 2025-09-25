# Copilot Instructions for Korfball-game-statistics

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
- **No build/test instructions found**: If you add build tools, scripts, or tests, document them here.
- **Manual testing**: Validate features by running the app and simulating match scenarios.

## Project-Specific Patterns
- **Real-time Data Entry**: UI/logic should prioritize speed and accuracy for live match input.
- **Event Granularity**: Each shot and fault is tracked with location/context, not just summary stats.
- **Player State**: Track which players are active vs. on the bench throughout the match.

## Integration Points
- **No external dependencies documented**: If you add APIs, databases, or third-party services, update this section.

## Conventions
- **Naming**: Use clear, descriptive names for events, players, and UI elements (e.g., `shotLocation`, `playerStatus`).
- **File Organization**: Place future source code in folders by feature (e.g., `src/players/`, `src/match/`).
- **Documentation**: Update this file and the README with any new workflows or conventions.

## Examples
- When adding a new event type, ensure it includes location, player, and result fields.
- UI forms for team setup should allow quick editing and validation.

---
If any section is unclear or missing, please provide feedback so this guide can be improved for future AI agents.
