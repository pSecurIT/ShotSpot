import React from 'react';
import CourtVisualization from './CourtVisualization';
import SubstitutionPanel from './SubstitutionPanel';
import '../styles/FocusMode.css';

interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  jersey_number: number;
  role: string;
  is_active: boolean;
  gender?: string;
  starting_position?: 'offense' | 'defense';
}

interface Possession {
  id: number;
  game_id: number;
  team_id: number;
  period: number;
  started_at: string;
  ended_at: string | null;
  shots_taken: number;
  team_name?: string;
}

interface FocusModeProps {
  // Game data
  gameId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  currentPeriod: number;
  numberOfPeriods: number;
  homeAttackingSide?: 'left' | 'right' | null;
  
  // Timer data
  timerState?: 'stopped' | 'running' | 'paused';
  timeRemaining: string;
  
  // Players
  homePlayers: Player[];
  awayPlayers: Player[];
  
  // Possession
  activePossession: Possession | null;
  possessionDuration: number;
  
  // Handlers
  onShotRecorded: (shotInfo: { result: 'goal' | 'miss' | 'blocked'; teamId: number; opposingTeamId: number }) => void;
  onCenterLineCross: (teamId: number) => Promise<void>;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onNextPeriod: () => void;
  onEndGame: () => void;
  onExitFocus: () => void;
  onSubstitutionRecorded: () => void;
  canAddEvents: () => boolean;
  onResumeTimer: () => void;
  
  // Reset key for court visualization
  courtResetKey: number;
}

const FocusMode: React.FC<FocusModeProps> = ({
  gameId,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  currentPeriod,
  numberOfPeriods,
  homeAttackingSide,
  timerState,
  timeRemaining,
  homePlayers,
  awayPlayers,
  activePossession,
  possessionDuration,
  onShotRecorded,
  onCenterLineCross,
  onStartTimer,
  onPauseTimer,
  onNextPeriod,
  onEndGame,
  onExitFocus,
  onSubstitutionRecorded,
  canAddEvents,
  onResumeTimer,
  courtResetKey,
}) => {
  // Get team names for left and right sides
  const leftTeamName = homeAttackingSide === 'left' ? homeTeamName : awayTeamName;
  const rightTeamName = homeAttackingSide === 'right' ? homeTeamName : awayTeamName;
  const leftTeamId = homeAttackingSide === 'left' ? homeTeamId : awayTeamId;
  const rightTeamId = homeAttackingSide === 'right' ? homeTeamId : awayTeamId;

  // Check if left or right side has possession
  const leftHasPossession = activePossession?.team_id === leftTeamId;
  const rightHasPossession = activePossession?.team_id === rightTeamId;

  return (
    <div className="focus-mode">
      {/* Floating Exit Button */}
      <button onClick={onExitFocus} className="focus-exit-button" title="Exit Focus Mode (Press F)">
        <span className="exit-icon">✕</span>
        <span className="exit-text">Exit Focus</span>
      </button>

      {/* Header with score and timer */}
      <div className="focus-header">
        <div className="focus-score-display">
          <div className="team-score home">
            <div className="team-name">{homeTeamName}</div>
            <div className="score">{homeScore}</div>
          </div>
          <div className="timer-display">
            <div className="period">Period {currentPeriod}</div>
            <div className="time">{timeRemaining}</div>
          </div>
          <div className="team-score away">
            <div className="team-name">{awayTeamName}</div>
            <div className="score">{awayScore}</div>
          </div>
        </div>
      </div>

      {/* Main content area with court and controls */}
      <div className="focus-content">
        {/* Left side indicator */}
        <div className={`side-indicator left ${leftHasPossession ? 'has-possession' : ''}`}>
          <div className="indicator-content">
            <div className="team-name">{leftTeamName}</div>
            {leftHasPossession && (
              <div className="possession-badge">
                <div className="possession-pulse"></div>
                <span>⚽ BALL</span>
              </div>
            )}
          </div>
        </div>

        {/* Court visualization */}
        <div className="focus-court">
          <CourtVisualization
            key={courtResetKey}
            gameId={gameId}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            currentPeriod={currentPeriod}
            homeAttackingSide={homeAttackingSide}
            onShotRecorded={onShotRecorded}
            activePossession={activePossession}
            possessionDuration={possessionDuration}
            onCenterLineCross={onCenterLineCross}
            homePlayers={homePlayers}
            awayPlayers={awayPlayers}
            timerState={timerState}
            onResumeTimer={onResumeTimer}
            onPauseTimer={onPauseTimer}
            canAddEvents={canAddEvents}
          />
        </div>

        {/* Right side indicator */}
        <div className={`side-indicator right ${rightHasPossession ? 'has-possession' : ''}`}>
          <div className="indicator-content">
            <div className="team-name">{rightTeamName}</div>
            {rightHasPossession && (
              <div className="possession-badge">
                <div className="possession-pulse"></div>
                <span>⚽ BALL</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom control panel */}
      <div className="focus-controls">
        {/* Timer controls */}
        <div className="control-group timer-controls">
          {timerState === 'stopped' && (
            <button onClick={onStartTimer} className="control-button primary">
              <span className="icon">▶️</span>
              <span className="label">Start</span>
            </button>
          )}
          
          {timerState === 'paused' && (
            <button onClick={onStartTimer} className="control-button primary">
              <span className="icon">▶️</span>
              <span className="label">Resume</span>
            </button>
          )}
          
          {timerState === 'running' && (
            <button onClick={onPauseTimer} className="control-button secondary">
              <span className="icon">⏸️</span>
              <span className="label">Pause</span>
            </button>
          )}
          
          {currentPeriod < numberOfPeriods && (
            <button onClick={onNextPeriod} className="control-button secondary">
              <span className="icon">⏭️</span>
              <span className="label">Next Period</span>
            </button>
          )}
        </div>

        {/* Possession info */}
        {activePossession && (
          <div className="control-group possession-info">
            <div className="possession-team">{activePossession.team_name}</div>
            <div className="possession-stats">
              <span className="stat">
                <span className="icon">⏱️</span>
                {Math.floor(possessionDuration / 60)}:{(possessionDuration % 60).toString().padStart(2, '0')}
              </span>
              <span className="stat">
                <span className="icon">🎯</span>
                {activePossession.shots_taken} shots
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="control-group action-buttons">
          <button onClick={onExitFocus} className="control-button secondary">
            <span className="icon">◀️</span>
            <span className="label">Exit Focus</span>
          </button>
          <button onClick={onEndGame} className="control-button danger">
            <span className="icon">🏁</span>
            <span className="label">End Game</span>
          </button>
        </div>
      </div>

      {/* Substitution panel - collapsible */}
      <div className="focus-substitution">
        <SubstitutionPanel
          gameId={gameId}
          homeTeamId={homeTeamId}
          awayTeamId={awayTeamId}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          currentPeriod={currentPeriod}
          timeRemaining={timeRemaining}
          onSubstitutionRecorded={onSubstitutionRecorded}
          canAddEvents={canAddEvents}
        />
      </div>
    </div>
  );
};

export default FocusMode;
