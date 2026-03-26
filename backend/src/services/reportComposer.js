import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify';
import db from '../db.js';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const EXPORTS_DIR = path.join(currentDirname, '../../exports');

const LEGACY_SECTION_MAP = {
  game_info: { type: 'summary', title: 'Game Overview', config: { summaryFocus: 'scoreboard' } },
  player_stats: { type: 'stats', title: 'Player Statistics', config: { metrics: ['goals', 'shots', 'accuracy'] } },
  shot_chart: { type: 'charts', title: 'Shot Chart', config: { chartType: 'shot_distribution' } },
  timeline: { type: 'charts', title: 'Scoring Timeline', config: { chartType: 'scoring_timeline' } },
  team_comparison: { type: 'comparison', title: 'Team Comparison', config: { compareAgainst: 'opponent' } },
  zone_analysis: { type: 'charts', title: 'Efficiency Trend', config: { chartType: 'efficiency_trend' } },
  hot_cold_zones: { type: 'charts', title: 'Shot Chart', config: { chartType: 'shot_distribution' } },
};

const METRIC_LABELS = {
  goals: 'Goals',
  shots: 'Shots',
  accuracy: 'Accuracy',
  misses: 'Misses',
  players: 'Active Players',
  games: 'Games',
  avg_goals_per_game: 'Avg Goals / Game',
  avg_shots_per_game: 'Avg Shots / Game',
};

function sanitizeFilenameComponent(component) {
  return String(component ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeTemplateSections(template) {
  const sections = ensureArray(template?.sections);

  if (sections.length === 0) {
    return [
      { id: 'summary-default', type: 'summary', title: 'Summary', description: '', config: { summaryFocus: 'performance' } },
      { id: 'stats-default', type: 'stats', title: 'Key Metrics', description: '', config: { metrics: ['goals', 'shots', 'accuracy'] } },
    ];
  }

  return sections.map((section, index) => {
    if (typeof section === 'string') {
      const legacy = LEGACY_SECTION_MAP[section] || {
        type: 'summary',
        title: section.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()),
        config: {},
      };

      return {
        id: section,
        type: legacy.type,
        title: legacy.title,
        description: '',
        config: legacy.config,
        order: index,
      };
    }

    return {
      id: section.id || `section-${index + 1}`,
      type: section.type || 'summary',
      title: section.title || `Section ${index + 1}`,
      description: section.description || '',
      config: typeof section.config === 'object' && section.config !== null ? section.config : {},
      order: index,
    };
  });
}

function buildMetricCatalog(scope) {
  const metrics = {
    goals: scope.metrics.goals,
    shots: scope.metrics.shots,
    accuracy: `${round(scope.metrics.accuracy, 1)}%`,
    misses: scope.metrics.misses,
    players: scope.metrics.players,
    games: scope.metrics.games,
    avg_goals_per_game: round(scope.metrics.avgGoalsPerGame, 2),
    avg_shots_per_game: round(scope.metrics.avgShotsPerGame, 2),
  };

  return metrics;
}

function pickMetricItems(metricNames, scope) {
  const catalog = buildMetricCatalog(scope);
  return metricNames
    .filter(name => name in catalog)
    .map(name => ({
      key: name,
      label: METRIC_LABELS[name] || name,
      value: catalog[name],
    }));
}

function groupShotsByPeriod(shots) {
  const periodMap = new Map();

  shots.forEach(shot => {
    const period = shot.period || 1;
    const existing = periodMap.get(period) || { period, shots: 0, goals: 0 };
    existing.shots += 1;
    if (shot.result === 'goal') {
      existing.goals += 1;
    }
    periodMap.set(period, existing);
  });

  return Array.from(periodMap.values()).sort((left, right) => left.period - right.period);
}

function computeMetrics(shots, gameIds) {
  const goals = shots.filter(shot => shot.result === 'goal').length;
  const shotCount = shots.length;
  const players = new Set(shots.map(shot => shot.player_id).filter(Boolean)).size;
  const games = gameIds.size || 0;

  return {
    goals,
    shots: shotCount,
    misses: Math.max(shotCount - goals, 0),
    accuracy: shotCount > 0 ? (goals / shotCount) * 100 : 0,
    players,
    games,
    avgGoalsPerGame: games > 0 ? goals / games : goals,
    avgShotsPerGame: games > 0 ? shotCount / games : shotCount,
  };
}

function buildSummarySection(section, scope) {
  const summaryFocus = section.config.summaryFocus || 'performance';
  const baseMetrics = pickMetricItems(['goals', 'shots', 'accuracy'], scope);

  const headlineMap = {
    scoreboard: scope.headline,
    performance: `${scope.entityLabel} produced ${scope.metrics.goals} goals from ${scope.metrics.shots} shots.`,
    momentum: `${scope.entityLabel} finished with ${round(scope.metrics.accuracy, 1)}% shooting efficiency.`,
  };

  return {
    ...section,
    data: {
      headline: headlineMap[summaryFocus] || headlineMap.performance,
      keyMetrics: baseMetrics,
      context: scope.contextSummary,
    },
  };
}

function buildStatsSection(section, scope) {
  const metricNames = ensureArray(section.config.metrics);
  const items = pickMetricItems(metricNames.length > 0 ? metricNames : ['goals', 'shots', 'accuracy'], scope);

  return {
    ...section,
    data: {
      items,
      topPerformers: scope.topPerformers,
    },
  };
}

function buildChartsSection(section, scope) {
  const chartType = section.config.chartType || 'shot_distribution';
  let series = [];

  if (chartType === 'shot_distribution') {
    series = scope.periodBreakdown.map(period => ({
      label: `Period ${period.period}`,
      values: {
        shots: period.shots,
        goals: period.goals,
      },
    }));
  } else if (chartType === 'scoring_timeline') {
    series = [
      {
        label: scope.entityLabel,
        points: scope.periodBreakdown.map(period => ({
          label: `P${period.period}`,
          value: period.goals,
        })),
      },
    ];
  } else if (chartType === 'efficiency_trend') {
    series = [
      {
        label: scope.entityLabel,
        points: scope.gameBreakdown.map(game => ({
          label: game.label,
          value: round(game.accuracy, 1),
        })),
      },
    ];
  }

  return {
    ...section,
    data: {
      chartType,
      series,
    },
  };
}

function buildCommentarySection(section, scope) {
  const notes = [];
  const style = section.config.commentaryStyle || 'coach';

  notes.push(`${scope.entityLabel} generated ${scope.metrics.goals} goals from ${scope.metrics.shots} attempts.`);

  if (scope.topPerformers.length > 0) {
    const leader = scope.topPerformers[0];
    notes.push(`${leader.name} led the output with ${leader.goals} goals on ${leader.shots} shots.`);
  }

  if (scope.comparison?.items?.length > 0) {
    const strongestGap = scope.comparison.items[0];
    notes.push(`${scope.entityLabel} ${strongestGap.delta >= 0 ? 'outperformed' : 'trailed'} ${strongestGap.label.toLowerCase()} by ${Math.abs(round(strongestGap.delta, 1))}${strongestGap.suffix || ''}.`);
  }

  if (style === 'broadcast') {
    notes.unshift(`${scope.headline} ${scope.contextSummary}`.trim());
  }

  return {
    ...section,
    data: {
      style,
      focus: section.config.commentaryFocus || 'highlights',
      notes,
    },
  };
}

function buildComparisonSection(section, scope) {
  return {
    ...section,
    data: {
      compareAgainst: section.config.compareAgainst || 'season_average',
      items: scope.comparison?.items || [],
    },
  };
}

function buildSection(section, scope) {
  switch (section.type) {
  case 'summary':
    return buildSummarySection(section, scope);
  case 'stats':
    return buildStatsSection(section, scope);
  case 'charts':
    return buildChartsSection(section, scope);
  case 'commentary':
    return buildCommentarySection(section, scope);
  case 'comparison':
    return buildComparisonSection(section, scope);
  default:
    return {
      ...section,
      data: { items: [] },
    };
  }
}

async function fetchGameScope(gameId) {
  const gameResult = await db.query(`
    SELECT
      g.*,
      hc.name AS home_club_name,
      ac.name AS away_club_name
    FROM games g
    JOIN clubs hc ON hc.id = g.home_club_id
    JOIN clubs ac ON ac.id = g.away_club_id
    WHERE g.id = $1
  `, [gameId]);

  if (gameResult.rows.length === 0) {
    throw new Error('Game not found');
  }

  const game = gameResult.rows[0];

  const shotsResult = await db.query(`
    SELECT
      s.*,
      p.first_name,
      p.last_name,
      p.team_id,
      c.name AS club_name
    FROM shots s
    JOIN players p ON p.id = s.player_id
    JOIN clubs c ON c.id = s.club_id
    WHERE s.game_id = $1
    ORDER BY s.period, s.created_at
  `, [gameId]);

  const shots = shotsResult.rows;
  const gameIds = new Set([gameId]);
  const metrics = computeMetrics(shots, gameIds);
  const homeShots = shots.filter(shot => shot.club_id === game.home_club_id);
  const awayShots = shots.filter(shot => shot.club_id === game.away_club_id);
  const homeMetrics = computeMetrics(homeShots, gameIds);
  const awayMetrics = computeMetrics(awayShots, gameIds);

  return {
    entityLabel: `${game.home_club_name} vs ${game.away_club_name}`,
    headline: `${game.home_club_name} ${game.home_score}-${game.away_score} ${game.away_club_name}`,
    contextSummary: `Completed on ${new Date(game.date).toLocaleDateString('en-GB')}.`,
    metrics,
    periodBreakdown: groupShotsByPeriod(shots),
    gameBreakdown: [
      {
        label: new Date(game.date).toLocaleDateString('en-GB'),
        accuracy: metrics.accuracy,
      },
    ],
    topPerformers: buildTopPerformers(shots),
    comparison: {
      items: [
        {
          label: game.away_club_name,
          metric: 'Goals',
          current: homeMetrics.goals,
          baseline: awayMetrics.goals,
          delta: homeMetrics.goals - awayMetrics.goals,
        },
        {
          label: game.away_club_name,
          metric: 'Accuracy',
          current: round(homeMetrics.accuracy, 1),
          baseline: round(awayMetrics.accuracy, 1),
          delta: round(homeMetrics.accuracy - awayMetrics.accuracy, 1),
          suffix: '%',
        },
      ],
    },
    subject: {
      type: 'game',
      id: game.id,
      homeClubId: game.home_club_id,
      awayClubId: game.away_club_id,
      game,
    },
  };
}

async function resolveTeamScope(teamId) {
  const teamResult = await db.query(`
    SELECT
      t.*,
      c.name AS club_name
    FROM teams t
    JOIN clubs c ON c.id = t.club_id
    WHERE t.id = $1
  `, [teamId]);

  if (teamResult.rows.length === 0) {
    throw new Error('Team not found');
  }

  return teamResult.rows[0];
}

function extractDateRange(dateRange) {
  const range = dateRange && typeof dateRange === 'object' ? dateRange : {};
  return {
    start: range.start || range.startDate || null,
    end: range.end || range.endDate || null,
  };
}

async function fetchClubSeasonScope({ clubId, teamId, playerId, dateRange, reportType }) {
  let team = null;
  let effectiveClubId = clubId || null;

  if (teamId) {
    team = await resolveTeamScope(teamId);
    effectiveClubId = team.club_id;
  }

  if (!effectiveClubId && playerId) {
    const playerResult = await db.query('SELECT club_id FROM players WHERE id = $1', [playerId]);
    effectiveClubId = playerResult.rows[0]?.club_id || null;
  }

  const range = extractDateRange(dateRange);
  const params = [];
  const where = [];
  let paramIndex = 1;

  if (effectiveClubId) {
    where.push(`s.club_id = $${paramIndex}`);
    params.push(effectiveClubId);
    paramIndex += 1;
  }

  if (teamId) {
    where.push(`p.team_id = $${paramIndex}`);
    params.push(teamId);
    paramIndex += 1;
  }

  if (playerId) {
    where.push(`s.player_id = $${paramIndex}`);
    params.push(playerId);
    paramIndex += 1;
  }

  if (range.start) {
    where.push(`g.date >= $${paramIndex}`);
    params.push(range.start);
    paramIndex += 1;
  }

  if (range.end) {
    where.push(`g.date <= $${paramIndex}`);
    params.push(range.end);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const shotsResult = await db.query(`
    SELECT
      s.*,
      p.first_name,
      p.last_name,
      p.team_id,
      g.date AS game_date,
      c.name AS club_name
    FROM shots s
    JOIN players p ON p.id = s.player_id
    JOIN games g ON g.id = s.game_id
    LEFT JOIN clubs c ON c.id = s.club_id
    ${whereClause}
    ORDER BY g.date DESC, s.created_at DESC
  `, params);

  const gamesResult = await db.query(`
    SELECT DISTINCT
      g.id,
      g.date,
      g.home_score,
      g.away_score,
      hc.name AS home_club_name,
      ac.name AS away_club_name,
      g.home_club_id,
      g.away_club_id
    FROM games g
    LEFT JOIN clubs hc ON hc.id = g.home_club_id
    LEFT JOIN clubs ac ON ac.id = g.away_club_id
    ${effectiveClubId ? `WHERE (g.home_club_id = $1 OR g.away_club_id = $1)${range.start ? ' AND g.date >= $2' : ''}${range.end ? ` AND g.date <= $${range.start ? 3 : 2}` : ''}` : range.start || range.end ? `WHERE ${range.start ? 'g.date >= $1' : ''}${range.start && range.end ? ' AND ' : ''}${range.end ? `g.date <= $${range.start ? 2 : 1}` : ''}` : ''}
    ORDER BY g.date DESC
  `, effectiveClubId
    ? [effectiveClubId].concat(range.start ? [range.start] : []).concat(range.end ? [range.end] : [])
    : [].concat(range.start ? [range.start] : []).concat(range.end ? [range.end] : []));

  const shots = shotsResult.rows;
  const games = gamesResult.rows;
  const gameIds = new Set(games.map(game => game.id));
  const metrics = computeMetrics(shots, gameIds);
  const entityLabel = playerId
    ? `${shots[0]?.first_name || 'Player'} ${shots[0]?.last_name || ''}`.trim()
    : team
      ? team.name
      : shots[0]?.club_name || 'Season';

  const previousGame = games[1] || null;
  let previousMetrics = null;

  if (previousGame) {
    const previousShots = shots.filter(shot => shot.game_id === previousGame.id);
    previousMetrics = computeMetrics(previousShots, new Set([previousGame.id]));
  }

  return {
    entityLabel,
    headline: reportType === 'player'
      ? `${entityLabel} across ${metrics.games || 1} games`
      : `${entityLabel} across ${metrics.games || 1} games`,
    contextSummary: range.start || range.end
      ? `Filtered from ${range.start || 'the beginning'} to ${range.end || 'today'}.`
      : 'Using all available matches in scope.',
    metrics,
    periodBreakdown: groupShotsByPeriod(shots),
    gameBreakdown: games.map(game => {
      const gameShots = shots.filter(shot => shot.game_id === game.id);
      const gameMetrics = computeMetrics(gameShots, new Set([game.id]));
      return {
        label: new Date(game.date).toLocaleDateString('en-GB'),
        accuracy: gameMetrics.accuracy,
      };
    }),
    topPerformers: playerId ? [] : buildTopPerformers(shots),
    comparison: {
      items: previousMetrics
        ? [
          {
            label: 'Previous Game',
            metric: 'Goals',
            current: metrics.goals,
            baseline: previousMetrics.goals,
            delta: metrics.goals - previousMetrics.goals,
          },
          {
            label: 'Previous Game',
            metric: 'Accuracy',
            current: round(metrics.accuracy, 1),
            baseline: round(previousMetrics.accuracy, 1),
            delta: round(metrics.accuracy - previousMetrics.accuracy, 1),
            suffix: '%',
          },
        ]
        : [
          {
            label: 'Season Average',
            metric: 'Goals / Game',
            current: round(metrics.avgGoalsPerGame, 2),
            baseline: round(metrics.avgGoalsPerGame, 2),
            delta: 0,
          },
        ],
    },
    subject: {
      type: reportType,
      clubId: effectiveClubId,
      teamId: teamId || null,
      playerId: playerId || null,
      team,
      games,
    },
  };
}

function buildTopPerformers(shots) {
  const playerMap = new Map();

  shots.forEach(shot => {
    const key = shot.player_id;
    const existing = playerMap.get(key) || {
      playerId: shot.player_id,
      name: `${shot.first_name || ''} ${shot.last_name || ''}`.trim() || 'Unknown Player',
      goals: 0,
      shots: 0,
    };

    existing.shots += 1;
    if (shot.result === 'goal') {
      existing.goals += 1;
    }

    playerMap.set(key, existing);
  });

  return Array.from(playerMap.values())
    .map(player => ({
      ...player,
      accuracy: player.shots > 0 ? round((player.goals / player.shots) * 100, 1) : 0,
    }))
    .sort((left, right) => {
      if (right.goals !== left.goals) {
        return right.goals - left.goals;
      }
      return right.accuracy - left.accuracy;
    })
    .slice(0, 5);
}

export async function composeReport({ template, reportType, gameId, clubId, teamId, playerId, dateRange }) {
  let scope;

  if (reportType === 'game') {
    scope = await fetchGameScope(gameId);
  } else {
    scope = await fetchClubSeasonScope({
      clubId,
      teamId,
      playerId,
      dateRange,
      reportType,
    });
  }

  const sections = normalizeTemplateSections(template).map(section => buildSection(section, scope));

  return {
    generatedAt: new Date().toISOString(),
    reportType,
    format: null,
    template: {
      id: template.id,
      name: template.name,
      type: template.type,
    },
    headline: scope.headline,
    contextSummary: scope.contextSummary,
    metrics: buildMetricCatalog(scope),
    subject: scope.subject,
    sections,
  };
}

async function ensureExportsDir() {
  await fs.mkdir(EXPORTS_DIR, { recursive: true });
}

function buildPdfBuffer(reportData) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 48 });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(reportData.template.name || 'Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(reportData.headline || '', { align: 'center' });
    doc.text(reportData.contextSummary || '', { align: 'center' });
    doc.moveDown();

    reportData.sections.forEach(section => {
      doc.fontSize(14).text(section.title);
      doc.moveDown(0.3);

      if (section.description) {
        doc.fontSize(10).text(section.description);
        doc.moveDown(0.3);
      }

      const rows = flattenSectionRows(section);
      if (rows.length === 0) {
        doc.fontSize(10).text('No data available for this section.');
      } else {
        rows.forEach(row => {
          const detailParts = [row.metric, row.value, row.detail].filter(Boolean);
          doc.fontSize(10).text(detailParts.join(': '));
        });
      }

      doc.moveDown();
    });

    doc.end();
  });
}

function buildCsvBuffer(reportData) {
  const rows = [['Section', 'Type', 'Metric', 'Value', 'Detail']];

  reportData.sections.forEach(section => {
    const sectionRows = flattenSectionRows(section);
    if (sectionRows.length === 0) {
      rows.push([section.title, section.type, '', '', '']);
      return;
    }

    sectionRows.forEach(row => {
      rows.push([
        section.title,
        section.type,
        row.metric || '',
        row.value ?? '',
        row.detail || '',
      ]);
    });
  });

  return new Promise((resolve, reject) => {
    stringify(rows, (error, output) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(output, 'utf8'));
    });
  });
}

function flattenSectionRows(section) {
  const data = section.data || {};
  const rows = [];

  if (data.headline) {
    rows.push({ metric: 'Headline', value: data.headline });
  }

  ensureArray(data.keyMetrics).forEach(item => {
    rows.push({ metric: item.label || item.key, value: item.value });
  });

  ensureArray(data.items).forEach(item => {
    rows.push({ metric: item.metric || item.label || item.key, value: item.current ?? item.value, detail: item.baseline !== undefined ? `Baseline: ${item.baseline}` : '' });
  });

  ensureArray(data.notes).forEach(note => {
    rows.push({ metric: 'Note', value: note });
  });

  ensureArray(data.series).forEach(series => {
    if (Array.isArray(series.points)) {
      series.points.forEach(point => {
        rows.push({ metric: series.label, value: point.value, detail: point.label });
      });
      return;
    }

    rows.push({ metric: series.label, value: JSON.stringify(series.values || {}) });
  });

  return rows;
}

export async function writeReportFile({ reportId, reportName, format, reportData }) {
  await ensureExportsDir();

  const extension = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'pdf';
  const fileName = `${sanitizeFilenameComponent(reportName || 'report') || 'report'}-${reportId}.${extension}`;
  const absolutePath = path.join(EXPORTS_DIR, fileName);

  let fileBuffer;
  if (format === 'json') {
    fileBuffer = Buffer.from(JSON.stringify({ ...reportData, format }, null, 2), 'utf8');
  } else if (format === 'csv') {
    fileBuffer = await buildCsvBuffer({ ...reportData, format });
  } else {
    fileBuffer = await buildPdfBuffer({ ...reportData, format });
  }

  await fs.writeFile(absolutePath, fileBuffer);

  return {
    filePath: `/exports/${fileName}`,
    fileSizeBytes: fileBuffer.length,
  };
}