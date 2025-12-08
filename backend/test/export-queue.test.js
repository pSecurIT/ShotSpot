import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import db from '../src/db.js';
import { enqueueExport, getQueueStatus } from '../src/utils/exportQueue.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const testFilename = fileURLToPath(import.meta.url);
const testDirname = path.dirname(testFilename);

describe('Export Queue', () => {
  let testTeamId;
  let testExportId;
  let testUserId;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(`
      INSERT INTO users (username, password_hash, email, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, ['exporttest', 'hashedpass', 'export@test.com', 'coach']);
    testUserId = userResult.rows[0].id;

    // Create test team
    const teamResult = await db.query(
      'INSERT INTO teams (name) VALUES ($1) RETURNING id',
      ['Test Export Team']
    );
    testTeamId = teamResult.rows[0].id;

    // Create test export record
    const exportResult = await db.query(`
      INSERT INTO report_exports (generated_by, report_name, report_type, format)
      VALUES ($1, 'Test Report', 'team', 'pdf-standard')
      RETURNING id
    `, [testUserId]);
    testExportId = exportResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM report_exports WHERE generated_by = $1', [testUserId]);
    await db.query('DELETE FROM teams WHERE id = $1', [testTeamId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);

    // Clean up generated file if it exists
    try {
      const exportsDir = path.join(testDirname, '../exports');
      const files = await fs.readdir(exportsDir);
      const testFiles = files.filter(f => f.includes(`team-${testTeamId}`) || f.includes(`${testExportId}`));
      
      for (const file of testFiles) {
        await fs.unlink(path.join(exportsDir, file));
      }
    } catch (_err) {
      // Ignore if files don't exist
    }
  });

  it('✅ should successfully generate team export with PDF', async () => {
    // Enqueue export - returns the job
    const job = enqueueExport(testExportId, null, 'pdf-standard', null, testTeamId, null, testUserId);
    expect(job).toBeDefined();
    expect(job.exportId).toBe(testExportId);

    // Wait for processing (max 5 seconds)
    let attempts = 0;
    let exportRecord;
    
    while (attempts < 50) {
      exportRecord = await db.query(
        'SELECT * FROM report_exports WHERE id = $1',
        [testExportId]
      );
      
      const record = exportRecord.rows[0];
      
      // Success: file_path is set (not null)
      if (record.file_path) {
        expect(record.file_path).toBeTruthy();
        expect(record.file_path).toMatch(/team-\d+-\d+\.pdf/);
        
        // Verify file exists - strip /exports/ prefix from database path
        const fileName = record.file_path.replace(/^\/exports\//, '');
        const filePath = path.join(testDirname, '../exports', fileName);
        const fileExists = await fs.access(filePath)
          .then(() => true)
          .catch(() => false);
        
        expect(fileExists).toBe(true);
        return; // Test passed
      }
      
      // Error: file_path explicitly set to NULL after processing attempt
      if (record.file_path === null && attempts > 10) {
        // If we've waited a bit and file_path is still null, it might have failed
        // But we need to distinguish between "still processing" and "failed"
        // Since there's no explicit status field, we can't tell for sure
        // Wait a bit more
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // If we get here, export timed out
    const finalRecord = await db.query(
      'SELECT * FROM report_exports WHERE id = $1',
      [testExportId]
    );
    console.log('Final export record:', finalRecord.rows[0]);
    throw new Error('Export processing timed out after 5 seconds');
  }, 10000); // 10 second timeout for test

  it('✅ should successfully generate sample export when no team/game/player specified', async () => {
    // Create another export record for sample
    const sampleExportResult = await db.query(`
      INSERT INTO report_exports (generated_by, report_name, report_type, format)
      VALUES ($1, 'Sample Report', 'team', 'pdf-standard')
      RETURNING id
    `, [testUserId]);
    const sampleExportId = sampleExportResult.rows[0].id;

    try {
      // Enqueue sample export (no gameId, teamId, or playerId)
      enqueueExport(sampleExportId, null, 'pdf-standard', null, null, null, testUserId);

      // Wait for processing
      let attempts = 0;
      
      while (attempts < 50) {
        const exportRecord = await db.query(
          'SELECT * FROM report_exports WHERE id = $1',
          [sampleExportId]
        );
        
        const record = exportRecord.rows[0];
        
        if (record.file_path) {
          expect(record.file_path).toBeTruthy();
          expect(record.file_path).toMatch(/sample-\d+\.pdf/);
          
          // Verify file exists - strip /exports/ prefix from database path
          const fileName = record.file_path.replace(/^\/exports\//, '');
          const filePath = path.join(testDirname, '../exports', fileName);
          const fileExists = await fs.access(filePath)
            .then(() => true)
            .catch(() => false);
          
          expect(fileExists).toBe(true);
          
          // Clean up
          await fs.unlink(filePath);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      throw new Error('Sample export timed out');
    } finally {
      // Clean up export record
      await db.query('DELETE FROM report_exports WHERE id = $1', [sampleExportId]);
    }
  }, 10000);

  it('✅ should handle CSV format exports', async () => {
    // Create export record for CSV
    const csvExportResult = await db.query(`
      INSERT INTO report_exports (generated_by, report_name, report_type, format)
      VALUES ($1, 'CSV Report', 'team', 'csv-detailed')
      RETURNING id
    `, [testUserId]);
    const csvExportId = csvExportResult.rows[0].id;

    try {
      enqueueExport(csvExportId, null, 'csv-detailed', null, testTeamId, null, testUserId);

      let attempts = 0;
      
      while (attempts < 50) {
        const exportRecord = await db.query(
          'SELECT * FROM report_exports WHERE id = $1',
          [csvExportId]
        );
        
        const record = exportRecord.rows[0];
        
        if (record.file_path) {
          expect(record.file_path).toBeTruthy();
          expect(record.file_path).toMatch(/team-\d+-\d+\.csv/);
          
          // Verify file exists - strip /exports/ prefix from database path
          const fileName = record.file_path.replace(/^\/exports\//, '');
          const filePath = path.join(testDirname, '../exports', fileName);
          const fileExists = await fs.access(filePath)
            .then(() => true)
            .catch(() => false);
          
          expect(fileExists).toBe(true);
          
          // Clean up
          await fs.unlink(filePath);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      throw new Error('CSV export timed out');
    } finally {
      await db.query('DELETE FROM report_exports WHERE id = $1', [csvExportId]);
    }
  }, 10000);

  it('📊 should track queue status', () => {
    const status = getQueueStatus();
    expect(status).toHaveProperty('queueLength');
    expect(status).toHaveProperty('isProcessing');
    expect(typeof status.queueLength).toBe('number');
    expect(typeof status.isProcessing).toBe('boolean');
  });
});
