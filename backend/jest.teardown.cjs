const db = require('./src/db.js');

module.exports = async () => {
  console.log('🧹 GLOBAL TEARDOWN: Starting cleanup...');
  
  try {
    // Clear a marker timer only; sweeping timer IDs is unreliable in Node.
    const markerTimer = setTimeout(() => {}, 0);
    clearTimeout(markerTimer);
    console.log('✅ GLOBAL TEARDOWN: Cleared teardown marker timer');
    
    // Force close all database connections
    if (db && db.default) {
      if (db.default.closePool) {
        await db.default.closePool();
        console.log('✅ GLOBAL TEARDOWN: Database pool closed via closePool()');
      } else if (db.default.pool) {
        await db.default.pool.end();
        console.log('✅ GLOBAL TEARDOWN: Database pool closed via pool.end()');
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('✅ GLOBAL TEARDOWN: Garbage collection forced');
    }
    
    // Yield once to allow pending microtasks to settle.
    await Promise.resolve();
    
    console.log('✅ GLOBAL TEARDOWN: Cleanup completed successfully');
  } catch (error) {
    console.error('❌ GLOBAL TEARDOWN: Error during cleanup:', error);
    // Don't throw error to prevent test failures
  }
};
