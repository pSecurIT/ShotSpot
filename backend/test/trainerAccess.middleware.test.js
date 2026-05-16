import db from '../src/db.js';
import { logError } from '../src/utils/logger.js';
import { hasTrainerAccess, requireTrainerForClubOrTeam } from '../src/middleware/trainerAccess.js';

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

describe('trainerAccess middleware utilities', () => {
  const buildRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasTrainerAccess', () => {
    it('returns false when no clubId and no teamId are provided', async () => {
      const allowed = await hasTrainerAccess(10, {});
      expect(allowed).toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns true when assignment exists', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const allowed = await hasTrainerAccess(11, { clubId: 7, teamId: null });

      expect(allowed).toBe(true);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('returns false when assignment does not exist', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const allowed = await hasTrainerAccess(12, { clubId: null, teamId: 22 });

      expect(allowed).toBe(false);
    });
  });

  describe('requireTrainerForClubOrTeam', () => {
    it('returns 401 when request has no authenticated user', async () => {
      const middleware = requireTrainerForClubOrTeam(() => ({ clubId: 1 }));
      const res = buildRes();
      const next = jest.fn();

      await middleware({}, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows admin users without trainer assignment checks', async () => {
      const middleware = requireTrainerForClubOrTeam(() => ({ clubId: 1 }));
      const req = { user: { userId: 1, role: 'admin' } };
      const res = buildRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns 403 for non-coach, non-admin roles', async () => {
      const middleware = requireTrainerForClubOrTeam(() => ({ clubId: 1 }));
      const req = { user: { userId: 2, role: 'user' } };
      const res = buildRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when extractor does not provide club or team context', async () => {
      const middleware = requireTrainerForClubOrTeam(() => ({}));
      const req = { user: { userId: 3, role: 'coach' } };
      const res = buildRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Club or team context required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when coach has no active assignment', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const middleware = requireTrainerForClubOrTeam(() => ({ clubId: 10, teamId: 50 }));
      const req = { user: { userId: 4, role: 'coach' } };
      const res = buildRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Trainer assignment required for this club/team',
        clubId: 10,
        teamId: 50
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when coach has active assignment', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const middleware = requireTrainerForClubOrTeam(() => ({ teamId: 77 }));
      const req = { user: { userId: 5, role: 'coach' } };
      const res = buildRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 500 and logs error when extractor fails', async () => {
      const middleware = requireTrainerForClubOrTeam(() => {
        throw new Error('extract failure');
      });
      const req = { user: { userId: 6, role: 'coach' } };
      const res = buildRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(logError).toHaveBeenCalledWith('Trainer access check failed:', expect.any(Error));
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Trainer access verification failed' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
