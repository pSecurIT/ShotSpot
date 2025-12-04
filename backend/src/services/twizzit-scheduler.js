import cron from 'node-cron';
import { syncFull } from './twizzit-sync.js';
import pool from '../db.js';

let activeJobs = new Map(); // Store active cron jobs by frequency

/**
 * Initialize and start the Twizzit sync scheduler
 * Sets up cron jobs for hourly, daily, and weekly sync frequencies
 */
export function startScheduler() {
  if (process.env.NODE_ENV === 'test') {
    console.log('Skipping scheduler in test environment');
    return;
  }

  console.log('[Twizzit Scheduler] Starting automated sync scheduler...');

  // Hourly sync: Every hour on the hour
  const hourlyJob = cron.schedule('0 * * * *', async () => {
    console.log('[Twizzit Scheduler] Running hourly sync check...');
    await runScheduledSyncs('hourly');
  }, {
    scheduled: true,
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
  });

  // Daily sync: Every day at 2:00 AM
  const dailyJob = cron.schedule('0 2 * * *', async () => {
    console.log('[Twizzit Scheduler] Running daily sync check...');
    await runScheduledSyncs('daily');
  }, {
    scheduled: true,
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
  });

  // Weekly sync: Every Sunday at 2:00 AM
  const weeklyJob = cron.schedule('0 2 * * 0', async () => {
    console.log('[Twizzit Scheduler] Running weekly sync check...');
    await runScheduledSyncs('weekly');
  }, {
    scheduled: true,
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC'
  });

  activeJobs.set('hourly', hourlyJob);
  activeJobs.set('daily', dailyJob);
  activeJobs.set('weekly', weeklyJob);

  console.log('[Twizzit Scheduler] Scheduler started successfully');
  console.log('[Twizzit Scheduler] Hourly sync: Every hour at :00');
  console.log('[Twizzit Scheduler] Daily sync: Every day at 2:00 AM');
  console.log('[Twizzit Scheduler] Weekly sync: Every Sunday at 2:00 AM');
  console.log(`[Twizzit Scheduler] Timezone: ${process.env.SCHEDULER_TIMEZONE || 'UTC'}`);
}

/**
 * Stop all scheduled sync jobs
 */
export function stopScheduler() {
  console.log('[Twizzit Scheduler] Stopping scheduler...');
  
  for (const [frequency, job] of activeJobs) {
    job.stop();
    console.log(`[Twizzit Scheduler] Stopped ${frequency} job`);
  }
  
  activeJobs.clear();
  console.log('[Twizzit Scheduler] Scheduler stopped');
}

/**
 * Run syncs for all eligible configurations with the specified frequency
 * @param {string} frequency - 'hourly', 'daily', or 'weekly'
 */
async function runScheduledSyncs(frequency) {
  const startTime = Date.now();
  let eligibleConfigs = [];
  
  try {
    // Find all configurations with matching frequency that are eligible for sync
    const query = `
      SELECT 
        id,
        organization_id,
        organization_name,
        sync_enabled,
        sync_in_progress,
        auto_sync_frequency
      FROM twizzit_configs
      WHERE sync_enabled = true
        AND sync_in_progress = false
        AND auto_sync_frequency = $1
      ORDER BY organization_name
    `;

    const result = await pool.query(query, [frequency]);
    eligibleConfigs = result.rows;

    if (eligibleConfigs.length === 0) {
      console.log(`[Twizzit Scheduler] No eligible configurations for ${frequency} sync`);
      return;
    }

    console.log(`[Twizzit Scheduler] Found ${eligibleConfigs.length} eligible config(s) for ${frequency} sync`);

    // Process each configuration sequentially to avoid overwhelming the API
    for (const config of eligibleConfigs) {
      try {
        console.log(`[Twizzit Scheduler] Starting sync for organization: ${config.organization_name} (ID: ${config.organization_id})`);
        
        const syncResult = await syncFull(config.id);
        
        console.log(`[Twizzit Scheduler] Sync completed for ${config.organization_name}:`, {
          status: syncResult.status,
          players: `${syncResult.stats.players.created} created, ${syncResult.stats.players.updated} updated`,
          teams: `${syncResult.stats.teams.created} created, ${syncResult.stats.teams.updated} updated`,
          duration: `${syncResult.duration}ms`
        });
        
      } catch (error) {
        console.error(`[Twizzit Scheduler] Sync failed for ${config.organization_name}:`, error.message);
        // Continue with next configuration even if this one fails
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[Twizzit Scheduler] ${frequency} sync batch completed in ${totalDuration}ms`);

  } catch (error) {
    console.error(`[Twizzit Scheduler] Error running ${frequency} sync:`, error);
  }
}

/**
 * Get status of all scheduled jobs
 * @returns {Object} Status information about active cron jobs
 */
export function getSchedulerStatus() {
  const status = {
    running: activeJobs.size > 0,
    jobs: {}
  };

  for (const [frequency, job] of activeJobs) {
    status.jobs[frequency] = {
      scheduled: job.options.scheduled
    };
  }

  return status;
}

/**
 * Manually trigger a scheduled sync for testing purposes
 * @param {string} frequency - 'hourly', 'daily', or 'weekly'
 * @returns {Promise<Object>} Result of the sync operation
 */
export async function triggerManualScheduledSync(frequency) {
  if (!['hourly', 'daily', 'weekly'].includes(frequency)) {
    throw new Error(`Invalid frequency: ${frequency}. Must be 'hourly', 'daily', or 'weekly'`);
  }

  console.log(`[Twizzit Scheduler] Manual trigger for ${frequency} sync`);
  await runScheduledSyncs(frequency);
  
  return {
    success: true,
    message: `Scheduled ${frequency} sync completed`
  };
}
