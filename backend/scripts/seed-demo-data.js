#!/usr/bin/env node

/**
 * Seed demo clubs, teams and players into the local development database.
 * On-demand only (npm run seed-demo); never runs on startup or from setup-db.
 * Idempotent: existing rows are left untouched. Edit scripts/seed-data/demo-data.json to customise.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refusing to seed demo data when NODE_ENV=production');
  process.exit(1);
}

// Same load order as setup-db.js; must happen before db.js is imported.
dotenv.config({ path: path.join(scriptDir, '..', '..', '.env') });
dotenv.config({ path: path.join(scriptDir, '..', '.env'), override: true });

const { default: db } = await import('../src/db.js');

const dataPath = path.join(scriptDir, 'seed-data', 'demo-data.json');
const { clubs } = JSON.parse(readFileSync(dataPath, 'utf8'));

async function seed() {
  const counts = { clubs: 0, teams: 0, players: 0 };

  for (const club of clubs) {
    const clubRes = await db.query(
      `INSERT INTO clubs (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, (xmax = 0) AS inserted`,
      [club.name]
    );
    const clubId = clubRes.rows[0].id;
    if (clubRes.rows[0].inserted) counts.clubs++;

    for (const team of club.teams) {
      // teams UNIQUE(club_id, name, season_id) does not match when season_id is NULL
      const existing = await db.query(
        'SELECT id FROM teams WHERE club_id = $1 AND name = $2 AND season_id IS NULL',
        [clubId, team.name]
      );
      let teamId = existing.rows[0]?.id;
      if (!teamId) {
        const teamRes = await db.query(
          `INSERT INTO teams (club_id, name, age_group, gender)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [clubId, team.name, team.ageGroup, team.gender]
        );
        teamId = teamRes.rows[0].id;
        counts.teams++;
      }

      for (const [firstName, lastName, jersey, gender] of team.players) {
        const playerRes = await db.query(
          `INSERT INTO players
             (club_id, team_id, first_name, last_name, jersey_number, gender, is_twizzit_registered)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           ON CONFLICT (club_id, jersey_number) DO NOTHING`,
          [clubId, teamId, firstName, lastName, jersey, gender]
        );
        counts.players += playerRes.rowCount;
      }
    }
  }

  return counts;
}

try {
  const counts = await seed();
  console.log(`✅ Demo data seeded: ${counts.clubs} clubs, ${counts.teams} teams, ${counts.players} players added`);
} catch (error) {
  console.error('❌ Failed to seed demo data:', error.message);
  process.exitCode = 1;
} finally {
  await db.closePool();
}
