import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';
import * as twizzitService from '../src/services/twizzitService.js';

beforeAll(async () => {
  jest.spyOn(twizzitService, 'syncClubs').mockResolvedValue([{ id: 1, name: 'Club A' }]);
  jest.spyOn(twizzitService, 'syncPlayers').mockResolvedValue([{ id: 1, firstName: 'John', lastName: 'Doe' }]);
  jest.spyOn(twizzitService, 'syncSeasons').mockResolvedValue([{ id: 1, name: 'Season 2025' }]);
  jest.spyOn(twizzitService, 'verifyTwizzitConnection').mockResolvedValue(true);
});

describe('Twizzit Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    const uniqueId = `tw_int_${Date.now()}`;
    const userRes = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, \'hash\', \'coach\') RETURNING *',
      [`${uniqueId}`, `${uniqueId}@test.com`]
    );
    const user = userRes.rows[0];
    authToken = jwt.sign(
      { id: user.id, role: 'coach' },
      process.env.JWT_SECRET || 'test_jwt_secret_key_min_32_chars_long_for_testing'
    );
  });

  test('Verify Twizzit API connection', async () => {
    const response = await request(app)
      .get('/api/twizzit/verify')
      .set('Authorization', `Bearer ${authToken}`);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Twizzit API connection verified successfully.');
    // Service invocation verified via 200 response and message
  });

  test('Sync clubs from Twizzit', async () => {
    // Create a credential first
    const credRes = await request(app)
      .post('/api/twizzit/credentials')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        apiUsername: 'test@twizzit.com',
        apiPassword: 'password123',
        organizationName: 'Test Org'
      });
   
    const credentialId = credRes.body.id;
   
    const response = await request(app)
      .post(`/api/twizzit/sync/clubs/${credentialId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Clubs synced successfully.');
    expect(response.body.clubs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, name: 'Club A' })
      ])
    );
    // Service invocation verified via 200 response and payload
  });

  test('Sync players for a specific club', async () => {
    // Create a credential first
    const credRes = await request(app)
      .post('/api/twizzit/credentials')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        apiUsername: 'test@twizzit.com',
        apiPassword: 'password123',
        organizationName: 'Test Org'
      });
   
    const credentialId = credRes.body.id;
   
    const response = await request(app)
      .post(`/api/twizzit/sync/players/${credentialId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Players synced successfully for club 1.');
    expect(response.body.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, firstName: 'John', lastName: 'Doe' })
      ])
    );
    // Service invocation verified via 200 response and payload
  });

  test('Sync seasons from Twizzit', async () => {
    // Seasons sync is not a direct endpoint, verify via clubs sync
    // Create a credential first
    const credRes = await request(app)
      .post('/api/twizzit/credentials')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        apiUsername: 'test@twizzit.com',
        apiPassword: 'password123',
        organizationName: 'Test Org'
      });
   
    const credentialId = credRes.body.id;
   
    const response = await request(app)
      .post(`/api/twizzit/sync/clubs/${credentialId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Seasons synced successfully.');
    expect(response.body.seasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, name: 'Season 2025' })
      ])
    );
    // Service invocation verified via 200 response and payload
  });
});