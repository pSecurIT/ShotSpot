const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Sort tests by priority for clearer output
    // Run unit tests first, then integration tests
    const testOrder = [
      'health.test.js',     // Basic health check first
      'teams.test.js',      // Core entities
      'players.test.js',    // Core entities
      'games.test.js',      // Game management
      'shots.test.js',      // Game events
      'events.test.js',     // Game events
      'timer.test.js',      // Timer functionality
      'game-rosters.test.js', // Complex operations
      'substitutions.test.js'  // Complex operations
    ];

    return tests.sort((testA, testB) => {
      const orderA = testOrder.findIndex(pattern => testA.path.includes(pattern));
      const orderB = testOrder.findIndex(pattern => testB.path.includes(pattern));
      
      // If both tests are in our order list, use that order
      if (orderA !== -1 && orderB !== -1) {
        return orderA - orderB;
      }
      
      // If only one test is in our list, prioritize it
      if (orderA !== -1) return -1;
      if (orderB !== -1) return 1;
      
      // For tests not in our list, use alphabetical order
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;