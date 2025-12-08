/**
 * Simple in-memory job queue for export generation
 * In production, consider using a proper queue like Bull (Redis-based) or BullMQ
 */

import db from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

// In-memory queue
const jobQueue = [];
let isProcessing = false;

// Storage directory for exports
const EXPORTS_DIR = path.join(currentDirname, '../../exports');

/**
 * Ensure exports directory exists
 */
async function ensureExportsDir() {
  try {
    await fs.access(EXPORTS_DIR);
  } catch {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  }
}

/**
 * Add a job to the queue
 */
export function enqueueExport(exportId, templateId, format, gameId, teamId, playerId, userId) {
  const job = {
    exportId,
    templateId,
    format,
    gameId,
    teamId,
    playerId,
    userId,
    createdAt: new Date()
  };

  jobQueue.push(job);
  
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Export job queued: ${exportId}, Queue size: ${jobQueue.length}`);
  }

  // Start processing if not already running
  if (!isProcessing) {
    processQueue();
  }

  return job;
}

/**
 * Process the queue
 */
async function processQueue() {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    
    try {
      await processExportJob(job);
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`Export job ${job.exportId} failed:`, err);
      }
      
      // Mark export as failed
      try {
        await db.query(
          'UPDATE report_exports SET file_path = NULL WHERE id = $1',
          [job.exportId]
        );
      } catch (updateErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to update export status:', updateErr);
        }
      }
    }
  }

  isProcessing = false;
}

/**
 * Process a single export job
 */
async function processExportJob(job) {
  const { exportId, format, gameId, teamId, playerId } = job;

  if (process.env.NODE_ENV !== 'test') {
    console.log(`Processing export ${exportId}: format=${format}, gameId=${gameId}`);
  }

  await ensureExportsDir();

  let fileBuffer = null;
  let fileName = '';
  let fileSize = 0;

  // Generate the export based on type
  if (gameId) {
    // Game export
    fileName = `game-${gameId}-${exportId}.${format.includes('pdf') ? 'pdf' : 'csv'}`;
    fileBuffer = await generateGameExport(gameId, format);
  } else if (playerId) {
    // Player export
    fileName = `player-${playerId}-${exportId}.${format.includes('pdf') ? 'pdf' : 'csv'}`;
    fileBuffer = await generatePlayerExport(playerId, format);
  } else if (teamId) {
    // Team/Season export
    fileName = `team-${teamId}-${exportId}.${format.includes('pdf') ? 'pdf' : 'csv'}`;
    fileBuffer = await generateTeamExport(teamId, format);
  } else {
    // Generate sample report
    fileName = `sample-${exportId}.${format.includes('pdf') ? 'pdf' : 'csv'}`;
    fileBuffer = await generateSampleExport(format);
  }

  // Save file to disk
  const filePath = path.join(EXPORTS_DIR, fileName);
  await fs.writeFile(filePath, fileBuffer);
  fileSize = fileBuffer.length;

  // Update database with file path
  const relativePath = `/exports/${fileName}`;
  await db.query(
    'UPDATE report_exports SET file_path = $1, file_size_bytes = $2 WHERE id = $3',
    [relativePath, fileSize, exportId]
  );

  if (process.env.NODE_ENV !== 'test') {
    console.log(`Export ${exportId} completed: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);
  }
}

/**
 * Generate game export
 */
async function generateGameExport(gameId, format) {
  // Fetch game data
  const gameResult = await db.query(`
    SELECT 
      g.*,
      ht.name as home_team_name,
      at.name as away_team_name
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    WHERE g.id = $1
  `, [gameId]);

  if (gameResult.rows.length === 0) {
    throw new Error(`Game ${gameId} not found`);
  }

  const game = gameResult.rows[0];

  // Fetch shots
  const shotsResult = await db.query(`
    SELECT 
      s.*,
      p.first_name,
      p.last_name,
      p.jersey_number,
      t.name as team_name
    FROM shots s
    JOIN players p ON s.player_id = p.id
    JOIN teams t ON s.team_id = t.id
    WHERE s.game_id = $1
    ORDER BY s.period, s.created_at
  `, [gameId]);

  if (format.includes('pdf')) {
    return generateGamePDF(game, shotsResult.rows);
  } else {
    return generateGameCSV(game, shotsResult.rows);
  }
}

/**
 * Generate player export
 */
async function generatePlayerExport(playerId, format) {
  const playerResult = await db.query(`
    SELECT 
      p.*,
      t.name as team_name,
      COUNT(DISTINCT s.id) FILTER (WHERE s.result = 'goal') as total_goals,
      COUNT(DISTINCT s.id) as total_shots
    FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    LEFT JOIN shots s ON s.player_id = p.id
    WHERE p.id = $1
    GROUP BY p.id, t.name
  `, [playerId]);

  if (playerResult.rows.length === 0) {
    throw new Error(`Player ${playerId} not found`);
  }

  const player = playerResult.rows[0];

  if (format.includes('pdf')) {
    return generatePlayerPDF(player);
  } else {
    return generatePlayerCSV(player);
  }
}

/**
 * Generate team export
 */
async function generateTeamExport(teamId, format) {
  const teamResult = await db.query(`
    SELECT * FROM teams WHERE id = $1
  `, [teamId]);

  if (teamResult.rows.length === 0) {
    throw new Error(`Team ${teamId} not found`);
  }

  const playersResult = await db.query(`
    SELECT 
      p.*,
      COUNT(DISTINCT s.id) FILTER (WHERE s.result = 'goal') as total_goals,
      COUNT(DISTINCT s.id) as total_shots
    FROM players p
    LEFT JOIN shots s ON s.player_id = p.id
    WHERE p.team_id = $1
    GROUP BY p.id
    ORDER BY total_goals DESC
  `, [teamId]);

  const team = teamResult.rows[0];
  const players = playersResult.rows;

  if (format.includes('pdf')) {
    return generateTeamPDF(team, players);
  } else {
    return generateTeamCSV(team, players);
  }
}

/**
 * Generate sample export (no real data)
 */
async function generateSampleExport(format) {
  if (format.includes('pdf')) {
    return generateSamplePDF();
  } else {
    return generateSampleCSV();
  }
}

/**
 * PDF Generation functions
 */
function generateGamePDF(game, shots) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument();

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('Game Report', { align: 'center' });
    doc.moveDown();

    // Game Info
    doc.fontSize(14).text(`${game.home_team_name} vs ${game.away_team_name}`);
    doc.fontSize(12).text(`Date: ${new Date(game.game_date).toLocaleDateString()}`);
    doc.text(`Score: ${game.home_score || 0} - ${game.away_score || 0}`);
    doc.moveDown();

    // Shots Summary
    const homeShots = shots.filter(s => s.team_name === game.home_team_name);
    const awayShots = shots.filter(s => s.team_name === game.away_team_name);

    doc.fontSize(14).text('Shots Summary');
    doc.fontSize(10);
    doc.text(`${game.home_team_name}: ${homeShots.length} shots, ${homeShots.filter(s => s.result === 'goal').length} goals`);
    doc.text(`${game.away_team_name}: ${awayShots.length} shots, ${awayShots.filter(s => s.result === 'goal').length} goals`);

    doc.end();
  });
}

function generatePlayerPDF(player) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument();

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Player Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`${player.first_name} ${player.last_name}`);
    doc.fontSize(12).text(`Team: ${player.team_name || 'N/A'}`);
    doc.text(`Jersey: #${player.jersey_number}`);
    doc.moveDown();
    doc.text(`Total Goals: ${player.total_goals || 0}`);
    doc.text(`Total Shots: ${player.total_shots || 0}`);
    doc.text(`Success Rate: ${player.total_shots > 0 ? ((player.total_goals / player.total_shots) * 100).toFixed(1) : 0}%`);

    doc.end();
  });
}

function generateTeamPDF(team, players) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument();

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Team Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(team.name);
    doc.moveDown();
    doc.fontSize(14).text('Player Statistics');
    doc.fontSize(10);
    
    players.forEach(player => {
      doc.text(`#${player.jersey_number} ${player.first_name} ${player.last_name}: ${player.total_goals || 0} goals, ${player.total_shots || 0} shots`);
    });

    doc.end();
  });
}

function generateSamplePDF() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument();

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Sample Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text('This is a sample report with dummy data.');
    doc.text('Team A: 15 points | Team B: 12 points');
    doc.text('Total Shots: 45 | Success Rate: 67%');
    doc.text('Top Scorer: Player #7 - 8 goals');

    doc.end();
  });
}

/**
 * CSV Generation functions
 */
function generateGameCSV(game, shots) {
  return new Promise((resolve, reject) => {
    const records = shots.map(shot => ({
      'Player': `${shot.first_name} ${shot.last_name}`,
      'Jersey': shot.jersey_number,
      'Team': shot.team_name,
      'Period': shot.period,
      'Result': shot.result,
      'X Position': shot.x_position,
      'Y Position': shot.y_position
    }));

    stringify(records, { header: true }, (err, output) => {
      if (err) reject(err);
      else resolve(Buffer.from(output));
    });
  });
}

function generatePlayerCSV(player) {
  const csv = `Player Name,Jersey,Team,Total Goals,Total Shots,Success Rate
${player.first_name} ${player.last_name},${player.jersey_number},${player.team_name || 'N/A'},${player.total_goals || 0},${player.total_shots || 0},${player.total_shots > 0 ? ((player.total_goals / player.total_shots) * 100).toFixed(1) : 0}%`;
  
  return Promise.resolve(Buffer.from(csv));
}

function generateTeamCSV(team, players) {
  return new Promise((resolve, reject) => {
    const records = players.map(player => ({
      'Jersey': player.jersey_number,
      'First Name': player.first_name,
      'Last Name': player.last_name,
      'Goals': player.total_goals || 0,
      'Shots': player.total_shots || 0,
      'Success Rate': player.total_shots > 0 ? `${((player.total_goals / player.total_shots) * 100).toFixed(1)}%` : '0%'
    }));

    stringify(records, { header: true }, (err, output) => {
      if (err) reject(err);
      else resolve(Buffer.from(output));
    });
  });
}

function generateSampleCSV() {
  const csv = `Player Name,Position,Goals,Assists,Shots,Success Rate
John Doe,Attack,8,5,15,53%
Jane Smith,Defense,3,2,8,38%
Mike Johnson,Attack,6,4,12,50%
Team Total Stats,,,17,11,35,49%`;
  
  return Promise.resolve(Buffer.from(csv));
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return {
    queueLength: jobQueue.length,
    isProcessing
  };
}
