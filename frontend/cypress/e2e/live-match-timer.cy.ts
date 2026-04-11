const ADMIN_USER = {
  id: 2,
  username: 'cypadmin',
  email: 'cypadmin@example.com',
  role: 'admin',
};

const PERIOD_DURATION_SECONDS = 10 * 60;
const HOME_CLUB_ID = 100;
const AWAY_CLUB_ID = 101;

const ROSTER_PLAYERS = [
  {
    id: 1,
    player_id: 1,
    club_id: HOME_CLUB_ID,
    is_starting: true,
    first_name: 'John',
    last_name: 'Doe',
    jersey_number: 10,
    gender: 'male',
    starting_position: 'offense'
  },
  {
    id: 2,
    player_id: 2,
    club_id: HOME_CLUB_ID,
    is_starting: true,
    first_name: 'Jane',
    last_name: 'Smith',
    jersey_number: 11,
    gender: 'female',
    starting_position: 'offense'
  },
  {
    id: 3,
    player_id: 3,
    club_id: AWAY_CLUB_ID,
    is_starting: true,
    first_name: 'Alice',
    last_name: 'Jones',
    jersey_number: 20,
    gender: 'female',
    starting_position: 'offense'
  },
  {
    id: 4,
    player_id: 4,
    club_id: AWAY_CLUB_ID,
    is_starting: true,
    first_name: 'Bob',
    last_name: 'Brown',
    jersey_number: 21,
    gender: 'male',
    starting_position: 'offense'
  }
] as const;

const toTimeParts = (totalSeconds: number) => ({
  minutes: Math.floor(totalSeconds / 60),
  seconds: totalSeconds % 60,
});

const formatClock = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const parseClock = (clockText: string) => {
  const [minutesText, secondsText] = clockText.trim().split(':');
  return (Number(minutesText) * 60) + Number(secondsText);
};

const toIsoTimestamp = (value?: string) => (value ? new Date(value).getTime() : null);

describe('Live Match Timer', () => {
  let gameSnapshot: {
    id: number;
    home_club_id: number;
    away_club_id: number;
    home_team_id: number;
    away_team_id: number;
    home_team_name: string;
    away_team_name: string;
    date: string;
    status: string;
    home_score: number;
    away_score: number;
    current_period: number;
    period_duration: { minutes: number; seconds: number };
    time_remaining: { minutes: number; seconds: number };
    timer_state: 'stopped' | 'running' | 'paused';
    home_attacking_side: string;
    number_of_periods: number;
  };
  let timerSnapshot: {
    current_period: number;
    period_duration: { minutes: number; seconds: number };
    time_remaining: { minutes: number; seconds: number };
    timer_state: 'stopped' | 'running' | 'paused';
    timer_started_at?: string;
    timer_paused_at?: string;
  };
  let activePossession: null | {
    id: number;
    game_id: number;
    club_id: number;
    period: number;
    started_at: string;
    ended_at: null;
    shots_taken: number;
    club_name: string;
  };
  let shots: Array<Record<string, unknown>>;
  let timeoutHistory: Array<Record<string, unknown>>;
  let faultHistory: Array<Record<string, unknown>>;
  let freeShotHistory: Array<Record<string, unknown>>;
  let nextPossessionId: number;
  let nextShotId: number;
  let nextTimeoutId: number;
  let nextFaultId: number;
  let nextFreeShotId: number;

  const getPlayer = (playerId: number) => ROSTER_PLAYERS.find(player => player.player_id === playerId);
  const getTeamName = (clubId: number) => clubId === HOME_CLUB_ID ? 'Home Team' : 'Away Team';

  const getTimerResponse = () => {
    if (timerSnapshot.timer_state !== 'running') {
      return timerSnapshot;
    }

    const timerStartedAtMs = toIsoTimestamp(timerSnapshot.timer_started_at);
    if (!timerStartedAtMs) {
      return timerSnapshot;
    }

    const baseRemainingSeconds = (timerSnapshot.time_remaining.minutes * 60) + timerSnapshot.time_remaining.seconds;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timerStartedAtMs) / 1000));
    const remainingSeconds = Math.max(0, baseRemainingSeconds - elapsedSeconds);

    return {
      ...timerSnapshot,
      time_remaining: toTimeParts(remainingSeconds)
    };
  };

  const getDisplayedClockSeconds = () => cy.get('.scoreboard .time-remaining').invoke('text').then(parseClock);

  const waitForClockDropWithin = (milliseconds: number, minimumDropSeconds: number, maximumDropSeconds: number) => {
    getDisplayedClockSeconds().then((beforeSeconds) => {
      cy.wait(milliseconds);
      cy.get('.scoreboard .time-remaining').invoke('text').then((afterClock) => {
        const afterSeconds = parseClock(afterClock);
        expect(beforeSeconds - afterSeconds).to.be.within(minimumDropSeconds, maximumDropSeconds);
      });
    });
  };

  const expectClockUnchangedFor = (milliseconds: number) => {
    getDisplayedClockSeconds().then((beforeSeconds) => {
      cy.wait(milliseconds);
      cy.get('.scoreboard .time-remaining').invoke('text').then((afterClock) => {
        expect(parseClock(afterClock)).to.equal(beforeSeconds);
      });
    });
  };

  const syncSnapshotToDisplayedClock = () => getDisplayedClockSeconds().then((secondsRemaining) => {
    timerSnapshot.time_remaining = toTimeParts(secondsRemaining);
    return secondsRemaining;
  });

  const installApiStubs = () => {
    cy.intercept('GET', '/api/auth/csrf', {
      statusCode: 200,
      body: { csrfToken: 'cypress-csrf-token' }
    }).as('csrf');

    cy.intercept('GET', '/api/games/1', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          ...gameSnapshot,
          time_remaining: timerSnapshot.time_remaining,
          timer_state: timerSnapshot.timer_state,
          current_period: timerSnapshot.current_period
        }
      });
    }).as('getGame');

    cy.intercept('GET', '/api/timer/1', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          game_id: 1,
          ...getTimerResponse(),
        }
      });
    }).as('getTimer');

    cy.intercept('POST', '/api/timer/1/start', (req) => {
      timerSnapshot = {
        ...timerSnapshot,
        timer_state: 'running',
        timer_started_at: new Date().toISOString(),
        timer_paused_at: undefined,
      };

      req.reply({
        statusCode: 200,
        body: {
          message: 'Timer started',
          timer_state: 'running',
          timer_started_at: timerSnapshot.timer_started_at,
          current_period: 1,
          time_remaining: timerSnapshot.time_remaining,
        }
      });
    }).as('startTimer');

    cy.intercept('POST', '/api/timer/1/pause', (req) => {
      timerSnapshot = {
        ...timerSnapshot,
        timer_state: 'paused',
        timer_paused_at: new Date().toISOString(),
      };

      req.reply({
        statusCode: 200,
        body: {
          message: 'Timer paused',
          timer_state: 'paused',
          timer_paused_at: timerSnapshot.timer_paused_at,
          time_remaining: timerSnapshot.time_remaining,
        }
      });
    }).as('pauseTimer');

    cy.intercept('GET', '/api/game-rosters/1', {
      statusCode: 200,
      body: ROSTER_PLAYERS
    }).as('getRoster');

    cy.intercept('GET', '/api/shots/1*', (req) => {
      req.reply({
        statusCode: 200,
        body: shots
      });
    }).as('getShots');

    cy.intercept('GET', '/api/possessions/1/active', (req) => {
      if (!activePossession) {
        req.reply({
          statusCode: 404,
          body: { error: 'No active possession found' }
        });
        return;
      }

      req.reply({
        statusCode: 200,
        body: activePossession
      });
    }).as('getActivePossession');

    cy.intercept('GET', '/api/possessions/1/stats', {
      statusCode: 200,
      body: []
    }).as('getPossessionStats');

    cy.intercept('GET', '/api/substitutions/1/active-players', {
      statusCode: 200,
      body: {
        home_team: {
          active: ROSTER_PLAYERS.filter(player => player.club_id === HOME_CLUB_ID),
          bench: []
        },
        away_team: {
          active: ROSTER_PLAYERS.filter(player => player.club_id === AWAY_CLUB_ID),
          bench: []
        }
      }
    }).as('getActivePlayers');

    cy.intercept('GET', '/api/substitutions/1*', {
      statusCode: 200,
      body: []
    }).as('getSubstitutions');

    cy.intercept('GET', '/api/timeouts/1', (req) => {
      req.reply({
        statusCode: 200,
        body: timeoutHistory
      });
    }).as('getTimeouts');

    cy.intercept('POST', '/api/timeouts', (req) => {
      const clubId = Number(req.body.club_id || HOME_CLUB_ID);
      const timeout = {
        id: nextTimeoutId++,
        game_id: 1,
        team_id: clubId === HOME_CLUB_ID ? 1 : 2,
        timeout_type: req.body.timeout_type,
        period: timerSnapshot.current_period,
        time_remaining: formatClock((timerSnapshot.time_remaining.minutes * 60) + timerSnapshot.time_remaining.seconds),
        duration: req.body.duration,
        reason: req.body.reason,
        called_by: req.body.called_by,
        team_name: getTeamName(clubId),
        created_at: new Date(Date.now()).toISOString(),
      };

      timeoutHistory = [timeout, ...timeoutHistory];

      req.reply({
        statusCode: 201,
        body: timeout
      });
    }).as('recordTimeout');

    cy.intercept('PUT', /\/api\/timeouts\/\d+\/end$/, (req) => {
      const timeoutId = Number(req.url.split('/').slice(-2)[0]);
      timeoutHistory = timeoutHistory.map(timeout => (
        timeout.id === timeoutId
          ? { ...timeout, ended_at: new Date(Date.now()).toISOString() }
          : timeout
      ));

      req.reply({
        statusCode: 200,
        body: { success: true }
      });
    }).as('endTimeout');

    cy.intercept('GET', '/api/free-shots/1', (req) => {
      req.reply({
        statusCode: 200,
        body: freeShotHistory
      });
    }).as('getFreeShots');

    cy.intercept('POST', '/api/free-shots', (req) => {
      const playerId = Number(req.body.player_id);
      const player = getPlayer(playerId);
      const clubId = Number(req.body.club_id);
      const freeShot = {
        id: nextFreeShotId++,
        game_id: 1,
        player_id: playerId,
        club_id: clubId,
        period: timerSnapshot.current_period,
        time_remaining: formatClock((timerSnapshot.time_remaining.minutes * 60) + timerSnapshot.time_remaining.seconds),
        free_shot_type: req.body.free_shot_type,
        reason: req.body.reason,
        result: req.body.result,
        distance: req.body.distance,
        first_name: player?.first_name || '',
        last_name: player?.last_name || '',
        jersey_number: player?.jersey_number || 0,
        club_name: getTeamName(clubId),
        created_at: new Date(Date.now()).toISOString()
      };

      freeShotHistory = [freeShot, ...freeShotHistory];

      req.reply({
        statusCode: 201,
        body: freeShot
      });
    }).as('recordFreeShot');

    cy.intercept('GET', '/api/events/comprehensive/1', (req) => {
      req.reply({
        statusCode: 200,
        body: faultHistory
      });
    }).as('getComprehensiveEvents');

    cy.intercept('GET', /\/api\/events\/1(?:\?.*)?$/, (req) => {
      const eventType = req.query.event_type;
      const body = typeof eventType === 'string'
        ? faultHistory.filter(event => event.event_type === eventType)
        : faultHistory;

      req.reply({
        statusCode: 200,
        body
      });
    }).as('getEvents');

    cy.intercept('POST', '/api/events/1', (req) => {
      const clubId = Number(req.body.club_id);
      const playerId = req.body.player_id ? Number(req.body.player_id) : null;
      const player = playerId ? getPlayer(playerId) : undefined;
      const fault = {
        id: nextFaultId++,
        game_id: 1,
        event_type: req.body.event_type,
        club_id: clubId,
        player_id: playerId,
        period: timerSnapshot.current_period,
        time_remaining: formatClock((timerSnapshot.time_remaining.minutes * 60) + timerSnapshot.time_remaining.seconds),
        details: req.body.details,
        club_name: getTeamName(clubId),
        first_name: player?.first_name,
        last_name: player?.last_name,
        jersey_number: player?.jersey_number,
        created_at: new Date(Date.now()).toISOString(),
      };

      faultHistory = [fault, ...faultHistory];

      req.reply({
        statusCode: 201,
        body: fault
      });
    }).as('recordFault');

    cy.intercept('GET', '/api/possessions/1*', (req) => {
      if (req.url.includes('/active') || req.url.includes('/stats')) {
        req.continue();
        return;
      }

      req.reply({
        statusCode: 200,
        body: activePossession ? [activePossession] : []
      });
    }).as('getPossessions');

    cy.intercept('POST', '/api/possessions/1', (req) => {
      activePossession = {
        id: nextPossessionId++,
        game_id: 1,
        club_id: Number(req.body.club_id),
        period: Number(req.body.period),
        started_at: new Date(Date.now()).toISOString(),
        ended_at: null,
        shots_taken: 0,
        club_name: Number(req.body.club_id) === 100 ? 'Home Team' : 'Away Team'
      };

      req.reply({
        statusCode: 201,
        body: activePossession
      });
    }).as('createPossession');

    cy.intercept('PATCH', '/api/possessions/1/*/increment-shots', {
      statusCode: 200,
      body: {
        id: 1,
        shots_taken: 1,
      }
    }).as('incrementShots');

    cy.intercept('POST', '/api/shots/1', (req) => {
      const clubId = Number(req.body.club_id);
      const playerId = Number(req.body.player_id);
      const isGoal = req.body.result === 'goal';

      if (isGoal) {
        if (clubId === HOME_CLUB_ID) {
          gameSnapshot.home_score += 1;
        } else {
          gameSnapshot.away_score += 1;
        }
      }

      const shot = {
        id: nextShotId++,
        game_id: 1,
        club_id: clubId,
        player_id: playerId,
        result: req.body.result,
        shot_type: req.body.shot_type,
        period: timerSnapshot.current_period,
        x_coord: req.body.x_coord,
        y_coord: req.body.y_coord,
        distance: req.body.distance,
        created_at: new Date(Date.now()).toISOString(),
        event_status: 'confirmed'
      };

      shots = [shot, ...shots];

      req.reply({
        statusCode: 201,
        body: shot
      });
    }).as('recordShot');
  };

  beforeEach(() => {
    gameSnapshot = {
      id: 1,
      home_club_id: HOME_CLUB_ID,
      away_club_id: AWAY_CLUB_ID,
      home_team_id: 1,
      away_team_id: 2,
      home_team_name: 'Home Team',
      away_team_name: 'Away Team',
      date: '2026-04-07T12:00:00.000Z',
      status: 'in_progress',
      home_score: 0,
      away_score: 0,
      current_period: 1,
      period_duration: { minutes: 10, seconds: 0 },
      time_remaining: { minutes: 10, seconds: 0 },
      timer_state: 'stopped',
      home_attacking_side: 'left',
      number_of_periods: 4,
    };
    timerSnapshot = {
      current_period: 1,
      period_duration: toTimeParts(PERIOD_DURATION_SECONDS),
      time_remaining: toTimeParts(PERIOD_DURATION_SECONDS),
      timer_state: 'stopped',
    };
    activePossession = null;
    shots = [];
    timeoutHistory = [];
    faultHistory = [];
    freeShotHistory = [];
    nextPossessionId = 1;
    nextShotId = 99;
    nextTimeoutId = 1;
    nextFaultId = 1;
    nextFreeShotId = 1;

    installApiStubs();

    cy.visit('/match/1', {
      onBeforeLoad: (win) => {
        win.localStorage.setItem('token', 'cypress-token');
        win.localStorage.setItem('user', JSON.stringify(ADMIN_USER));
      },
    });

    cy.contains('Timer Controls').should('be.visible');
  });

  it('keeps counting over a longer run and stays stable through pause and resume', () => {
    cy.contains('button', '▶️ Start Match').click();
    cy.get('.scoreboard .timer-status').should('contain', 'running');
    cy.get('.scoreboard .time-remaining').should('contain', '10:00');
    cy.wait('@startTimer');
    cy.wait('@getTimer');

    waitForClockDropWithin(6500, 6, 7);

    syncSnapshotToDisplayedClock();
    cy.contains('button', '⏸️ Pause').click();
    cy.wait('@pauseTimer');
    cy.wait('@getTimer');
    cy.get('.scoreboard .timer-status').should('contain', 'paused');
    cy.contains('button', '▶️ Resume').should('be.visible');
    expectClockUnchangedFor(2200);

    cy.contains('button', '▶️ Resume').click();
    cy.get('.scoreboard .timer-status').should('contain', 'running');
    cy.wait('@startTimer');
    cy.wait('@getTimer');

    waitForClockDropWithin(2500, 2, 3);
  });

  it('auto-pauses immediately after recording a goal', () => {
    cy.contains('button', '▶️ Start Match').click();
    cy.get('.scoreboard .timer-status').should('contain', 'running');
    cy.wait('@startTimer');

    syncSnapshotToDisplayedClock();

    cy.get('[title="Select John Doe"]').click();
    cy.get('.court-container').click(300, 200);
    cy.contains('button', '⚽ Goal').click();

    cy.contains('button', '▶️ Resume').should('be.visible');
    cy.wait('@pauseTimer');
    cy.wait('@recordShot');
    cy.get('.scoreboard .timer-status').should('contain', 'paused');
    cy.get('.scoreboard .team-section.home-team .score').should('contain', '1');
  });

  it('keeps the timer moving through a match-like run of goals and event panels', () => {
    let secondsAfterHomeGoal = 0;

    cy.contains('button', '▶️ Start Match').click();
    cy.get('.scoreboard .timer-status').should('contain', 'running');
    cy.wait('@startTimer');
    cy.wait('@getTimer');
    cy.wait('@createPossession');
    cy.get('.scoreboard .team-section.home-team .score').should('contain', '0');
    cy.get('.scoreboard .team-section.away-team .score').should('contain', '0');

    waitForClockDropWithin(3200, 3, 4);

    syncSnapshotToDisplayedClock();
    cy.get('[title="Select John Doe"]').click();
    cy.get('.court-container').click(300, 200);
    cy.contains('button', '⚽ Goal').click();
    cy.wait('@recordShot');
    cy.wait('@pauseTimer');
    cy.wait('@createPossession');
    cy.wait('@getGame');
    cy.get('.scoreboard .timer-status').should('contain', 'paused');
    cy.get('.scoreboard .time-remaining').invoke('text').then((pausedClock) => {
      secondsAfterHomeGoal = parseClock(pausedClock);
    });
    cy.get('.scoreboard .team-section.home-team .score', { timeout: 10000 }).should('contain', '1');
    cy.get('.scoreboard .team-section.away-team .score').should('contain', '0');

    cy.contains('button', '▶️ Resume').click();
    cy.get('.scoreboard .timer-status').should('contain', 'running');
    cy.wait('@startTimer');
    cy.wait('@getTimer');

    waitForClockDropWithin(2200, 2, 3);

    cy.contains('button', '⏸️ Timeouts').click();
    cy.get('.timeout-management').within(() => {
      cy.get('input[placeholder="Coach name"]').type('Coach Home');
      cy.get('input[placeholder="Brief description of timeout reason"]').type('Set play after restart');
      cy.contains('button', 'Start Team Timeout').click();
    });
    cy.wait('@recordTimeout');
    cy.contains('Team Timeout started successfully').should('be.visible');
    cy.get('.scoreboard .timer-status').should('contain', 'running');

    waitForClockDropWithin(2200, 1, 3);

    cy.contains('button', '⚠️ Faults').click();
    cy.get('.fault-management').within(() => {
      cy.contains('button', '🛡️ Defensive').click();
      cy.contains('label', 'Player:').parent().find('select').select('1');
      cy.get('input[placeholder="Brief description of the fault"]').type('Late block on the rebound');
      cy.contains('button', 'Record Defensive Fault').click();
    });
    cy.wait('@recordFault');
    cy.contains('Defensive Fault recorded successfully').should('be.visible');
    cy.get('.scoreboard .timer-status').should('contain', 'running');

    waitForClockDropWithin(2200, 2, 3);

    cy.contains('button', '🎯 Free Shots').click();
    cy.get('.free-shot-panel').within(() => {
      cy.contains('label', 'Player:').parent().find('select').select('1');
      cy.contains('button', '❌ Miss').click();
      cy.get('input[placeholder="What caused this free shot/penalty to be awarded?"]').type('Contact during the shot');
      cy.get('input[placeholder="Distance in meters"]').type('4.2');
      cy.contains('button', 'Record Free Shot').click();
    });
    cy.wait('@recordFreeShot');
    cy.contains('Free Shot recorded successfully').should('be.visible');
    cy.get('.scoreboard .timer-status').should('contain', 'running');

    waitForClockDropWithin(2200, 2, 3);

    syncSnapshotToDisplayedClock();
    cy.get('.court-visualization').scrollIntoView().within(() => {
      cy.contains('label', 'Team:').parent().find('select').select('away');
      cy.get('[title="Select Alice Jones"]').click();
    });
    cy.get('.court-container').scrollIntoView().click(860, 200, { force: true });
    cy.contains('button', '⚽ Goal').click();
    cy.wait('@recordShot');
    cy.wait('@pauseTimer');
    cy.wait('@createPossession');
    cy.wait('@getGame');
    cy.get('.scoreboard .timer-status').should('contain', 'paused');
    cy.get('.scoreboard .time-remaining').invoke('text').then((pausedClock) => {
      const awayGoalPauseSeconds = parseClock(pausedClock);
      expect(awayGoalPauseSeconds).to.be.lessThan(secondsAfterHomeGoal);
    });
    cy.get('.scoreboard .team-section.home-team .score', { timeout: 10000 }).should('contain', '1');
    cy.get('.scoreboard .team-section.away-team .score', { timeout: 10000 }).should('contain', '1');
    cy.contains('button', '▶️ Resume').should('be.visible');
  });
});

export {};
