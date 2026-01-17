import React, { useMemo } from 'react';
import type { TournamentBracketMatch } from '../types/competitions';

export type BracketSide = 'home' | 'away';

export interface BracketMatchProps {
  match: TournamentBracketMatch;
  x: number;
  y: number;
  width: number;
  height: number;
  animate?: boolean;
  onAssignTeam?: (matchId: number, side: BracketSide, teamId: number | null) => void;
  onSetWinner?: (matchId: number, winnerTeamId: number) => void;
}

function getTeamId(match: TournamentBracketMatch, side: BracketSide) {
  return side === 'home' ? match.home_team_id : match.away_team_id;
}

function getTeamName(match: TournamentBracketMatch, side: BracketSide) {
  return side === 'home' ? match.home_team_name : match.away_team_name;
}

function getScore(match: TournamentBracketMatch, side: BracketSide) {
  return side === 'home' ? match.home_score : match.away_score;
}

export const BracketMatch: React.FC<BracketMatchProps> = ({ match, x, y, width, height, animate, onAssignTeam, onSetWinner }) => {
  const homeWinner = match.winner_team_id != null && match.home_team_id === match.winner_team_id;
  const awayWinner = match.winner_team_id != null && match.away_team_id === match.winner_team_id;

  const canSetWinner = match.home_team_id != null && match.away_team_id != null;

  const hint = useMemo(() => {
    if (!match.home_team_id || !match.away_team_id) return 'Drag teams into slots';
    if (match.winner_team_id) return 'Winner set';
    return 'Click a team to set winner';
  }, [match.away_team_id, match.home_team_id, match.winner_team_id]);

  const handleDrop = (side: BracketSide) => (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const teamId = Number(raw);
    if (!Number.isFinite(teamId) || teamId <= 0) return;
    onAssignTeam?.(match.id, side, teamId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSetWinner = (side: BracketSide) => () => {
    if (!canSetWinner) return;
    const teamId = getTeamId(match, side);
    if (!teamId) return;
    onSetWinner?.(match.id, teamId);
  };

  const handleClear = (side: BracketSide) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onAssignTeam?.(match.id, side, null);
  };

  const slotHeight = Math.max(28, Math.floor((height - 22) / 2));
  const homeTeamId = getTeamId(match, 'home');
  const awayTeamId = getTeamId(match, 'away');

  return (
    <g transform={`translate(${x}, ${y})`}>
      <foreignObject x={0} y={0} width={width} height={height} requiredExtensions="http://www.w3.org/1999/xhtml">
        <div className={`bracket-match__box ${animate ? 'bracket-match--animate' : ''}`}>
          <div
            className={`bracket-match__slot bracket-match__slot--drop ${homeWinner ? 'bracket-match__slot--winner' : ''}`}
            style={{ height: `${slotHeight}px` }}
            onDragOver={handleDragOver}
            onDrop={handleDrop('home')}
            onClick={handleSetWinner('home')}
            role="button"
            tabIndex={0}
          >
            <span className="bracket-match__teamName">{getTeamName(match, 'home') ?? 'TBD'}</span>
            <span className="bracket-match__right">
              <span className="bracket-match__score">{typeof getScore(match, 'home') === 'number' ? getScore(match, 'home') : ''}</span>
              {homeTeamId != null && (
                <button type="button" className="bracket-match__clear" onClick={handleClear('home')} aria-label="Clear home team">
                  ×
                </button>
              )}
            </span>
          </div>

          <div
            className={`bracket-match__slot bracket-match__slot--drop ${awayWinner ? 'bracket-match__slot--winner' : ''}`}
            style={{ height: `${slotHeight}px` }}
            onDragOver={handleDragOver}
            onDrop={handleDrop('away')}
            onClick={handleSetWinner('away')}
            role="button"
            tabIndex={0}
          >
            <span className="bracket-match__teamName">{getTeamName(match, 'away') ?? 'TBD'}</span>
            <span className="bracket-match__right">
              <span className="bracket-match__score">{typeof getScore(match, 'away') === 'number' ? getScore(match, 'away') : ''}</span>
              {awayTeamId != null && (
                <button type="button" className="bracket-match__clear" onClick={handleClear('away')} aria-label="Clear away team">
                  ×
                </button>
              )}
            </span>
          </div>

          <div className="bracket-match__hint">{hint}</div>
        </div>
      </foreignObject>
    </g>
  );
};
