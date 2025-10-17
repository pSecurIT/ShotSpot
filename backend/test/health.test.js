import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('Health Check', () => {
  it('should return 200 OK for the health check endpoint', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('services');
  });

  afterAll(async () => {
    // Close the database pool (this is the last test file to run)
    await db.closePool();
  });
});