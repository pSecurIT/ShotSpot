import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import db from '../src/db.js';

describe('Seasons routes', () => {
  const unique = `seasons_${Date.now()}`;
  let user;
  let authToken;
  let seasonIds = [];

  beforeAll(async () => {
    user = (await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [`${unique}_coach`, `${unique}_coach@test.com`, 'hash', 'coach']
    )).rows[0];

    authToken = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
    );
  });

  afterEach(async () => {
    if (seasonIds.length > 0) {
      await db.query('DELETE FROM seasons WHERE id = ANY($1::int[])', [seasonIds]);
      seasonIds = [];
    }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
  });

  it('returns all seasons ordered when no active filter is provided', async () => {
    const created = await db.query(
      `INSERT INTO seasons (name, start_date, end_date, season_type, is_active)
       VALUES
       ($1, $2, $3, 'indoor', true),
       ($4, $5, $6, 'outdoor', false)
       RETURNING id`,
      [
        `${unique}_active`,
        '2026-01-01',
        '2026-06-01',
        `${unique}_inactive`,
        '2025-01-01',
        '2025-06-01'
      ]
    );

    seasonIds = created.rows.map((row) => row.id);

    const response = await request(app)
      .get('/api/seasons')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);

    const names = response.body.map((s) => s.name);
    expect(names).toContain(`${unique}_active`);
    expect(names).toContain(`${unique}_inactive`);
  });

  it('applies active=true and active=false filtering', async () => {
    const created = await db.query(
      `INSERT INTO seasons (name, start_date, end_date, season_type, is_active)
       VALUES
       ($1, $2, $3, 'indoor', true),
       ($4, $5, $6, 'outdoor', false)
       RETURNING id`,
      [
        `${unique}_only_active`,
        '2027-01-01',
        '2027-06-01',
        `${unique}_only_inactive`,
        '2024-01-01',
        '2024-06-01'
      ]
    );

    seasonIds = created.rows.map((row) => row.id);

    const activeResponse = await request(app)
      .get('/api/seasons?active=true')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(activeResponse.body.every((season) => season.is_active === true)).toBe(true);

    const inactiveResponse = await request(app)
      .get('/api/seasons?active=false')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(inactiveResponse.body.every((season) => season.is_active === false)).toBe(true);
  });

  it('returns 401 without authentication', async () => {
    await request(app)
      .get('/api/seasons')
      .expect(401);
  });

  it('returns 500 when season query fails', async () => {
    const querySpy = jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('db down'));

    const response = await request(app)
      .get('/api/seasons')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(500);

    expect(response.body.error).toBe('Failed to fetch seasons');
    expect(querySpy).toHaveBeenCalled();
  });
});
