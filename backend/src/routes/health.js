import express from 'express';
import { dbHealthCheck } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Check database connection
    await dbHealthCheck();

    // Return successful health check
    res.status(200).json({
      status: 'healthy',
      message: 'All systems operational',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected'
      }
    });
  } catch (error) {
    // Return degraded health status
    res.status(503).json({
      status: 'degraded',
      message: 'Service degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: error.message || 'disconnected'
      }
    });
  }
});

export default router;