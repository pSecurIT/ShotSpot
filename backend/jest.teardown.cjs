const db = require('./src/db.js');

module.exports = async () => {
  try {
    // Close the database pool to prevent hanging connections
    if (db && db.default && db.default.pool) {
      await db.default.pool.end();
      console.log('Database pool closed successfully');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};
