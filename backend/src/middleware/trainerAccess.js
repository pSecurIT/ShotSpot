import db from '../db.js';

const isAdmin = (req) => req.user && req.user.role && req.user.role.toLowerCase() === 'admin';

export async function hasTrainerAccess(userId, { clubId = null, teamId = null }) {
  if (!clubId && !teamId) return false;

  const result = await db.query(
    `SELECT 1
     FROM trainer_assignments
     WHERE user_id = $1
       AND is_active = true
       AND active_from <= CURRENT_DATE
       AND (active_to IS NULL OR active_to >= CURRENT_DATE)
       AND (
         club_id = $2
        OR ($3::int IS NOT NULL AND team_id = $3::int)
       )
     LIMIT 1`,
    [userId, clubId, teamId]
  );

  return result.rowCount > 0;
}

export const requireTrainerForClubOrTeam = (extractTarget) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isAdmin(req)) {
      return next();
    }

    const userRole = req.user.role ? req.user.role.toLowerCase() : null;
    if (userRole !== 'coach') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const target = await Promise.resolve(extractTarget(req));
    const clubId = target?.clubId || null;
    const teamId = target?.teamId || null;

    if (!clubId && !teamId) {
      return res.status(400).json({ error: 'Club or team context required' });
    }

    const allowed = await hasTrainerAccess(req.user.userId, { clubId, teamId });
    if (!allowed) {
      return res.status(403).json({
        error: 'Trainer assignment required for this club/team',
        clubId,
        teamId
      });
    }

    return next();
  } catch (error) {
    console.error('Trainer access check failed:', error);
    return res.status(500).json({ error: 'Trainer access verification failed' });
  }
};
