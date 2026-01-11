import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';

describe('📊 Dashboard API', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'user') RETURNING *`,
      [`dashboard_user_${unique}`, `dashboard_${unique}@test.com`, 'hash']
    );

    testUser = userResult.rows[0];
    authToken = jwt.sign({ id: testUser.id, role: 'user' }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    } catch (_e) {
      // ignore
    }
  });

  it('✅ GET /api/dashboard/summary returns counts', async () => {
    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('teams');
    expect(response.body).toHaveProperty('players');
    expect(response.body).toHaveProperty('games');
    expect(typeof response.body.teams).toBe('number');
  });

  it('❌ GET /api/dashboard/summary requires authentication', async () => {
    const response = await request(app)
      .get('/api/dashboard/summary');

    expect(response.status).toBe(401);
  });
});
