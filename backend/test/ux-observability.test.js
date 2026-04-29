import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import db from '../src/db.js';

describe('🧭 UX Observability API', () => {
  let adminUser;
  let coachUser;
  let regularUser;
  let adminToken;
  let coachToken;
  let userToken;

  beforeAll(async () => {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const adminResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING *`,
      [`ux_admin_${unique}`, `ux_admin_${unique}@test.com`, 'hash']
    );

    const coachResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'coach')
       RETURNING *`,
      [`ux_coach_${unique}`, `ux_coach_${unique}@test.com`, 'hash']
    );

    const userResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING *`,
      [`ux_user_${unique}`, `ux_user_${unique}@test.com`, 'hash']
    );

    adminUser = adminResult.rows[0];
    coachUser = coachResult.rows[0];
    regularUser = userResult.rows[0];

    adminToken = jwt.sign({ userId: adminUser.id, role: 'admin' }, process.env.JWT_SECRET);
    coachToken = jwt.sign({ userId: coachUser.id, role: 'coach' }, process.env.JWT_SECRET);
    userToken = jwt.sign({ userId: regularUser.id, role: 'user' }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    try {
      await db.query('DELETE FROM ux_metric_events WHERE user_id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
      await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUser.id, coachUser.id, regularUser.id]);
    } catch (_err) {
      // ignore cleanup issues
    }
  });

  it('✅ POST /api/ux-observability/events ingests valid metric events', async () => {
    const response = await request(app)
      .post('/api/ux-observability/events')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        events: [
          {
            routePath: '/games',
            flowName: 'open_games_list',
            eventType: 'flow_timing',
            metricName: 'route_load_ms',
            valueMs: 842,
            metadata: { source: 'test' }
          },
          {
            routePath: '/games',
            flowName: 'open_games_list',
            eventType: 'api_latency',
            metricName: 'api_latency_ms',
            endpoint: '/games',
            valueMs: 212,
            metadata: { method: 'GET' }
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.inserted).toBe(2);
  });

  it('❌ POST /api/ux-observability/events rejects invalid payloads', async () => {
    const response = await request(app)
      .post('/api/ux-observability/events')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        routePath: '/dashboard',
        flowName: 'login_to_dashboard',
        eventType: 'not_valid',
        metricName: 'route_load_ms',
        valueMs: 300,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/eventType/i);
  });

  it('✅ POST /api/ux-observability/events stores feedback signals', async () => {
    const response = await request(app)
      .post('/api/ux-observability/events')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        routePath: '/analytics/22',
        flowName: 'open_match_analytics',
        eventType: 'feedback',
        metricName: 'smoothness_rating',
        rating: 2,
        metadata: { message: 'Took too long to load chart' }
      });

    expect(response.status).toBe(201);
    expect(response.body.inserted).toBe(1);
  });

  it('✅ GET /api/dashboard/ux/overview is available to admins', async () => {
    const response = await request(app)
      .get('/api/dashboard/ux/overview?days=30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('overview');
    expect(response.body.overview).toHaveProperty('total_events');
    expect(response.body.overview).toHaveProperty('feedback_count');
  });

  it('❌ GET /api/dashboard/ux/overview denies non-admin users', async () => {
    const response = await request(app)
      .get('/api/dashboard/ux/overview')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(response.status).toBe(403);
  });

  it('✅ GET /api/dashboard/ux/flows returns flow timing rows for admins', async () => {
    const response = await request(app)
      .get('/api/dashboard/ux/flows?days=30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.flows)).toBe(true);
    expect(response.body.flows.some((row) => row.flow_name === 'open_games_list')).toBe(true);
  });

  it('✅ GET /api/dashboard/ux/feedback returns recent feedback rows for admins', async () => {
    const response = await request(app)
      .get('/api/dashboard/ux/feedback?days=30')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.feedback)).toBe(true);
    expect(response.body.feedback.some((row) => row.flow_name === 'open_match_analytics')).toBe(true);
  });

  it('❌ GET /api/ux-observability/events requires authentication', async () => {
    const response = await request(app)
      .post('/api/ux-observability/events')
      .send({
        routePath: '/games',
        flowName: 'open_games_list',
        eventType: 'flow_timing',
        metricName: 'route_load_ms',
        valueMs: 50,
      });

    expect(response.status).toBe(401);
  });
});