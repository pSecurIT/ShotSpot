import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Mock BracketMatch so we can directly trigger an assignment into a specific slot.
vi.mock('../components/BracketMatch', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    BracketMatch: ({ match, onAssignTeam }: { match: { id: number }; onAssignTeam?: (matchId: number, side: 'home' | 'away', teamId: number | null) => unknown }) => {
      React.useEffect(() => {
        if (match.id !== 2) return;

        // Simulate dragging team 101 onto match 2, away slot.
        void onAssignTeam?.(2, 'away', 101);
      }, [match.id, onAssignTeam]);

      return React.createElement('g', { 'data-testid': `mock-match-${match.id}` });
    },
  };
});

import { TournamentBracket } from '../components/TournamentBracket';

describe('TournamentBracket move behavior', () => {
  it('clears previous slot before assigning new slot', async () => {
    const onAssignTeam = vi.fn().mockResolvedValue(undefined);

    render(
      <TournamentBracket
        bracket={{
          competition_id: 1,
          rounds: [
            {
              round_number: 1,
              round_name: 'Round 1',
              matches: [
                {
                  id: 1,
                  competition_id: 1,
                  round_number: 1,
                  round_name: 'Round 1',
                  match_number: 1,
                  home_team_id: 101,
                  away_team_id: null,
                  winner_team_id: null,
                  game_id: null,
                  home_team_name: 'Team A',
                  away_team_name: null,
                },
                {
                  id: 2,
                  competition_id: 1,
                  round_number: 1,
                  round_name: 'Round 1',
                  match_number: 2,
                  home_team_id: null,
                  away_team_id: null,
                  winner_team_id: null,
                  game_id: null,
                  home_team_name: null,
                  away_team_name: null,
                },
              ],
            },
          ],
        }}
        teams={[
          { competition_id: 1, team_id: 101, team_name: 'Team A', seed: 1 },
          { competition_id: 1, team_id: 202, team_name: 'Team B', seed: 2 },
        ]}
        onAssignTeam={onAssignTeam}
        onSetWinner={vi.fn()}
      />
    );

    await waitFor(() => expect(onAssignTeam).toHaveBeenCalledTimes(2));

    expect(onAssignTeam).toHaveBeenNthCalledWith(1, 1, 'home', null);
    expect(onAssignTeam).toHaveBeenNthCalledWith(2, 2, 'away', 101);
  });
});
