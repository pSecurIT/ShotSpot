import db from '../src/db.js';
import { logError } from '../src/utils/logger.js';
import { validatePlayersInMatch } from '../src/middleware/validatePlayer.js';

jest.mock('../src/db.js', () => ({
  __esModule: true,
  default: {
    query: jest.fn()
  }
}));

jest.mock('../src/utils/logger.js', () => ({
  __esModule: true,
  logError: jest.fn()
}));

describe('validatePlayersInMatch middleware', () => {
  const buildRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next when all players are registered', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 1, first_name: 'Home', last_name: 'A', is_registered: true },
        { id: 2, first_name: 'Away', last_name: 'B', is_registered: true }
      ]
    });

    const req = { params: { matchId: '25' } };
    const res = buildRes();
    const next = jest.fn();

    await validatePlayersInMatch(req, res, next);

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM players p'),
      ['25']
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with unregistered players list', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 3, first_name: 'Test', last_name: 'Unregistered', is_registered: false },
        { id: 4, first_name: 'Other', last_name: 'Registered', is_registered: true }
      ]
    });

    const req = { params: { matchId: '77' } };
    const res = buildRes();
    const next = jest.fn();

    await validatePlayersInMatch(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unregistered players found',
      unregisteredPlayers: [
        { id: 3, name: 'Test Unregistered' }
      ]
    });
  });

  it('returns 500 and logs error when query fails', async () => {
    const failure = new Error('db unavailable');
    db.query.mockRejectedValue(failure);

    const req = { params: { matchId: '99' } };
    const res = buildRes();
    const next = jest.fn();

    await validatePlayersInMatch(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('Error validating players in match:', 'db unavailable');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to validate players in match',
      message: 'db unavailable'
    });
  });
});
