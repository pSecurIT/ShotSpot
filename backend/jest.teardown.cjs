const db = require('./src/db.js');

module.exports = async () => {
  console.log('🧹 GLOBAL TEARDOWN: Starting cleanup...');
  
  try {
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
    
    // Small delay to ensure all connections are fully closed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('✅ GLOBAL TEARDOWN: Cleanup completed successfully');
  } catch (error) {
    console.error('❌ GLOBAL TEARDOWN: Error during cleanup:', error);
    // Don't throw error to prevent test failures
  }
};
