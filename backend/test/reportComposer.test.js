var mockDbQuery = jest.fn();
var mockWriteFile = jest.fn();
var mockMkdir = jest.fn();
var mockStringify = jest.fn();

function MockPdfDocument() {
  this.handlers = new Map();
}

MockPdfDocument.prototype.on = function on(event, handler) {
  this.handlers.set(event, handler);
  return this;
};

MockPdfDocument.prototype.fontSize = function fontSize() {
  return this;
};

MockPdfDocument.prototype.text = function text() {
  return this;
};

MockPdfDocument.prototype.moveDown = function moveDown() {
  return this;
};

MockPdfDocument.prototype.end = function end() {
  const dataHandler = this.handlers.get('data');
  const endHandler = this.handlers.get('end');
  if (dataHandler) {
    dataHandler(Buffer.from('pdf-output'));
  }
  if (endHandler) {
    endHandler();
  }
};

jest.mock('../src/db.js', () => ({
  __esModule: true,
  default: {
    query: (...args) => mockDbQuery(...args)
  },
  query: (...args) => mockDbQuery(...args)
}));

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    mkdir: (...args) => mockMkdir(...args),
    writeFile: (...args) => mockWriteFile(...args)
  },
  mkdir: (...args) => mockMkdir(...args),
  writeFile: (...args) => mockWriteFile(...args)
}));

jest.mock('pdfkit', () => ({
  __esModule: true,
  default: MockPdfDocument
}));

jest.mock('csv-stringify', () => ({
  __esModule: true,
  stringify: (...args) => mockStringify(...args)
}));

import { composeReport, writeReportFile } from '../src/services/reportComposer.js';

describe('reportComposer service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockStringify.mockImplementation((rows, callback) => callback(null, rows.map(row => row.join(',')).join('\n')));
  });

  it('composes a game report with normalized legacy sections', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 9,
          home_club_id: 1,
          away_club_id: 2,
          home_club_name: 'Home Club',
          away_club_name: 'Away Club',
          home_score: 18,
          away_score: 15,
          date: '2024-01-15T00:00:00.000Z'
        }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            player_id: 11,
            first_name: 'Alex',
            last_name: 'Shooter',
            club_id: 1,
            club_name: 'Home Club',
            result: 'goal',
            period: 1,
            created_at: '2024-01-15T10:00:00.000Z'
          },
          {
            player_id: 12,
            first_name: 'Sam',
            last_name: 'Finisher',
            club_id: 2,
            club_name: 'Away Club',
            result: 'miss',
            period: 2,
            created_at: '2024-01-15T10:01:00.000Z'
          }
        ]
      });

    const report = await composeReport({
      template: {
        id: 4,
        name: 'Game Template',
        type: 'game',
        sections: ['game_info', 'player_stats', 'shot_chart', 'team_comparison', 'unknown_section']
      },
      reportType: 'game',
      gameId: 9
    });

    expect(report.template.name).toBe('Game Template');
    expect(report.headline).toBe('Home Club 18-15 Away Club');
    expect(report.metrics).toMatchObject({
      goals: 1,
      shots: 2,
      misses: 1,
      players: 2,
      games: 1,
      avg_goals_per_game: 1,
      avg_shots_per_game: 2,
      accuracy: '50%'
    });
    expect(report.sections[0]).toMatchObject({
      type: 'summary',
      title: 'Game Overview'
    });
    expect(report.sections[1].data.topPerformers[0]).toMatchObject({
      name: 'Alex Shooter',
      goals: 1,
      shots: 1,
      accuracy: 100
    });
    expect(report.sections[2].data.series[0].label).toBe('Period 1');
    expect(report.sections[3].data.items).toHaveLength(2);
    expect(report.sections[4]).toMatchObject({
      type: 'summary',
      title: 'Unknown Section'
    });
  });

  it('composes a scoped player report with commentary and comparison sections', async () => {
    mockDbQuery
      .mockResolvedValueOnce({ rows: [{ club_id: 7 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            player_id: 91,
            first_name: 'Jordan',
            last_name: 'Marks',
            team_id: 3,
            game_id: 501,
            game_date: '2024-02-05T00:00:00.000Z',
            club_name: 'Scoring Club',
            result: 'goal',
            period: 1,
            created_at: '2024-02-05T10:00:00.000Z'
          },
          {
            player_id: 91,
            first_name: 'Jordan',
            last_name: 'Marks',
            team_id: 3,
            game_id: 500,
            game_date: '2024-01-29T00:00:00.000Z',
            club_name: 'Scoring Club',
            result: 'miss',
            period: 2,
            created_at: '2024-01-29T10:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 501,
            date: '2024-02-05T00:00:00.000Z',
            home_score: 19,
            away_score: 17,
            home_club_name: 'Scoring Club',
            away_club_name: 'Opposition',
            home_club_id: 7,
            away_club_id: 8
          },
          {
            id: 500,
            date: '2024-01-29T00:00:00.000Z',
            home_score: 14,
            away_score: 13,
            home_club_name: 'Scoring Club',
            away_club_name: 'Opposition',
            home_club_id: 7,
            away_club_id: 8
          }
        ]
      });

    const report = await composeReport({
      template: {
        id: 8,
        name: 'Player Insights',
        type: 'player',
        sections: [
          { id: 'summary', type: 'summary', title: 'Summary', config: { summaryFocus: 'momentum' } },
          { id: 'commentary', type: 'commentary', title: 'Coach Notes', config: { commentaryStyle: 'broadcast' } },
          { id: 'comparison', type: 'comparison', title: 'Comparison', config: { compareAgainst: 'previous_game' } },
          { id: 'chart', type: 'charts', title: 'Trend', config: { chartType: 'efficiency_trend' } }
        ]
      },
      reportType: 'player',
      playerId: 91,
      dateRange: { start: '2024-01-01', end: '2024-02-28' }
    });

    expect(report.headline).toContain('Jordan Marks');
    expect(report.contextSummary).toContain('2024-01-01');
    expect(report.subject).toMatchObject({ type: 'player', clubId: 7, playerId: 91 });
    expect(report.sections[1].data.notes[0]).toContain(report.headline);
    expect(report.sections[2].data.compareAgainst).toBe('previous_game');
    expect(report.sections[2].data.items[0].label).toBe('Previous Game');
    expect(report.sections[3].data.series[0].points).toHaveLength(2);
  });

  it('writes a json report file with a sanitized filename', async () => {
    const result = await writeReportFile({
      reportId: 12,
      reportName: 'Coach / Review: Finals',
      format: 'json',
      reportData: { template: { name: 'Json Report' }, sections: [] }
    });

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [absolutePath, fileBuffer] = mockWriteFile.mock.calls[0];
    expect(absolutePath).toContain('Coach-Review-Finals-12.json');
    expect(fileBuffer.toString('utf8')).toContain('"format": "json"');
    expect(result.filePath).toBe('/exports/Coach-Review-Finals-12.json');
    expect(result.fileSizeBytes).toBe(fileBuffer.length);
  });

  it('writes a csv report file from flattened section rows', async () => {
    const result = await writeReportFile({
      reportId: 13,
      reportName: 'CSV Report',
      format: 'csv',
      reportData: {
        template: { name: 'CSV Report' },
        sections: [
          {
            title: 'Summary',
            type: 'summary',
            data: {
              headline: 'Team summary',
              keyMetrics: [{ label: 'Goals', value: 9 }],
              notes: ['Keep pace']
            }
          },
          {
            title: 'Charts',
            type: 'charts',
            data: {
              series: [{ label: 'Trend', points: [{ label: 'P1', value: 5 }] }]
            }
          }
        ]
      }
    });

    expect(mockStringify).toHaveBeenCalledTimes(1);
    const [, fileBuffer] = mockWriteFile.mock.calls[0];
    expect(fileBuffer.toString('utf8')).toContain('Section,Type,Metric,Value,Detail');
    expect(fileBuffer.toString('utf8')).toContain('Summary,summary,Headline,Team summary,');
    expect(result.filePath).toBe('/exports/CSV-Report-13.csv');
  });

  it('writes a pdf report file from flattened section rows', async () => {
    const result = await writeReportFile({
      reportId: 14,
      reportName: 'PDF Report',
      format: 'pdf',
      reportData: {
        template: { name: 'PDF Report' },
        headline: 'Headline',
        contextSummary: 'Context',
        sections: [
          {
            title: 'Stats',
            type: 'stats',
            description: 'Top lines',
            data: {
              items: [{ label: 'Goals', value: 4 }],
              series: [{ label: 'Shot Mix', values: { goals: 4, shots: 7 } }]
            }
          }
        ]
      }
    });

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, fileBuffer] = mockWriteFile.mock.calls[0];
    expect(fileBuffer.equals(Buffer.from('pdf-output'))).toBe(true);
    expect(result.filePath).toBe('/exports/PDF-Report-14.pdf');
    expect(result.fileSizeBytes).toBe(Buffer.from('pdf-output').length);
  });
});