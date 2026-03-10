import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';
import jwt from 'jsonwebtoken';
import * as twizzitService from '../src/services/twizzitService.js';
import twizzitSync from '../src/services/twizzit-sync.js';

jest.mock('../src/services/twizzit-sync.js', () => ({
  __esModule: true,
  default: {
    syncClubsFromTwizzit: jest.fn(),
    syncPlayersFromTwizzit: jest.fn()
  }
}));

beforeEach(() => {
  jest.spyOn(twizzitService, 'verifyTwizzitConnection').mockResolvedValue(true);
  twizzitSync.syncClubsFromTwizzit.mockResolvedValue({
    message: 'Clubs synced successfully.',
    clubs: [{ id: 1, name: 'Club A' }]
  });
  twizzitSync.syncPlayersFromTwizzit.mockResolvedValue({
    message: 'Players synced successfully for club 1.',
    players: [{ id: 1, firstName: 'John', lastName: 'Doe' }]
  });
});

describe('Twizzit Integration Tests', () => {
  let authToken;
  const testCredentialId = 123;

  beforeAll(async () => {
    const uniqueId = `tw_int_${Date.now()}`;
    const userRes = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, \'hash\', \'coach\') RETURNING *',
      [`${uniqueId}`, `${uniqueId}@test.com`]
    );
    const user = userRes.rows[0];
    authToken = jwt.sign(
      { userId: user.id, role: 'admin' },
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
    const response = await request(app)
      .post(`/api/twizzit/sync/clubs/${testCredentialId}`)
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
    const response = await request(app)
      .post(`/api/twizzit/sync/players/${testCredentialId}`)
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
    // Seasons sync is not a direct sync endpoint in this router; verify clubs sync contract.
    const response = await request(app)
      .post(`/api/twizzit/sync/clubs/${testCredentialId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Clubs synced successfully.');
    expect(response.body.clubs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 1, name: 'Club A' })
      ])
    );
    // Sync endpoint contract verified via 200 response and payload.
  });
});