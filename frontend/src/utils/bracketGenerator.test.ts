import { describe, expect, it } from 'vitest';
import type { TournamentBracket } from '../types/competitions';
import { buildBracketLayout } from './bracketGenerator';

function makeBracket4(): TournamentBracket {
  return {
    competition_id: 1,
    rounds: [
      {
        round_number: 1,
        round_name: 'Semi Finals',
        matches: [
          {
            id: 1,
            competition_id: 1,
            round_number: 1,
            round_name: 'Semi Finals',
            match_number: 1,
            home_team_id: 10,
            away_team_id: 11,
            winner_team_id: null,
            game_id: null,
            home_team_name: 'A',
            away_team_name: 'B',
            home_score: null,
            away_score: null,
          },
          {
            id: 2,
            competition_id: 1,
            round_number: 1,
            round_name: 'Semi Finals',
            match_number: 2,
            home_team_id: 12,
            away_team_id: 13,
            winner_team_id: null,
            game_id: null,
            home_team_name: 'C',
            away_team_name: 'D',
            home_score: null,
            away_score: null,
          },
        ],
      },
      {
        round_number: 2,
        round_name: 'Final',
        matches: [
          {
            id: 3,
            competition_id: 1,
            round_number: 2,
            round_name: 'Final',
            match_number: 3,
            home_team_id: null,
            away_team_id: null,
            winner_team_id: null,
            game_id: null,
            home_team_name: null,
            away_team_name: null,
            home_score: null,
            away_score: null,
          },
        ],
      },
    ],
  };
}

describe('🏆 bracketGenerator', () => {
  it('✅ builds nodes + connectors for 4-team bracket', () => {
    const layout = buildBracketLayout(makeBracket4(), {
      matchWidth: 200,
      matchHeight: 80,
      roundGap: 60,
      matchGap: 20,
      padding: 20,
    });

    expect(layout.nodes).toHaveLength(3);
    expect(layout.connectors).toHaveLength(2);

    // Round 0 has two matches, round 1 has one match.
    const round0 = layout.nodes.filter((n) => n.roundIndex === 0);
    const round1 = layout.nodes.filter((n) => n.roundIndex === 1);
    expect(round0).toHaveLength(2);
    expect(round1).toHaveLength(1);

    // x increases by matchWidth + roundGap.
    expect(round1[0].x).toBe(round0[0].x + 200 + 60);

    // Next round is vertically centered between previous two.
    const mid = (round0[0].y + round0[1].y + 80) / 2;
    const finalMid = round1[0].y + 80 / 2;
    expect(Math.abs(finalMid - mid)).toBeLessThan(2);
  });
});
