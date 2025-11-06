import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('🏥 Health Check', () => {
  it('✅ should return 200 OK for the health check endpoint', async () => {
    try {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
      console.log('      ✅ Health check endpoint working correctly');
    } catch (error) {
      console.log('      ❌ Health check test failed:', error.message);
      global.testContext.logTestError(error, 'Health check test failed');
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Close the database pool (this is the last test file to run)
      await db.closePool();
      console.log('✅ Health Check tests completed');
    } catch (error) {
      console.error('❌ Health Check cleanup error:', error.message);
      global.testContext.logTestError(error, 'Health Check cleanup error');
    }
  });
});