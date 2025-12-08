import dotenv from 'dotenv';

// Load and validate environment variables FIRST before any other imports
// Load root .env first (shared configuration)
dotenv.config({ path: '../.env' });
// Then load backend/.env to override with local development settings (use override to ensure local settings take precedence)
dotenv.config({ override: true });

// Now import modules that depend on environment variables
import { createServer } from 'http';
import { Server } from 'socket.io';
import validateEnv from './utils/validateEnv.js';
import app from './app.js';
import { verifyToken } from './middleware/auth.js';

// Validate environment variables after loading
validateEnv();

// Critical: Handle unhandled promise rejections and exceptions to prevent silent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
  // Don't exit in development to keep debugging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  // Don't exit in development to keep debugging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Test database connection before starting server
import db from './db.js';
import initDefaultAdmin from '../scripts/init-default-admin.js';

try {
  await db.healthCheck();
  console.log('✓ Database connection established');
  
  // Ensure exports directory exists
  if (process.env.NODE_ENV !== 'test') {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const exportsDir = path.join(__dirname, '../exports');
      await fs.access(exportsDir).catch(() => fs.mkdir(exportsDir, { recursive: true }));
      console.log('✓ Exports directory ready');
    } catch (dirErr) {
      console.warn('⚠️  Could not create exports directory:', dirErr.message);
    }
  }
  
  // Initialize default admin user if needed (only in non-test environments)
  if (process.env.NODE_ENV !== 'test') {
    try {
      await initDefaultAdmin();
    } catch (adminErr) {
      console.warn('⚠️  Default admin initialization encountered an issue:', adminErr.message);
      // Don't exit - this is not fatal, admin might already exist or be created manually
    }
  }
} catch (err) {
  console.error('✗ Failed to connect to database:', err.message);
  console.error('  Connection details:', {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'not set'
  });
  console.error('  Please check your database configuration and ensure PostgreSQL is running.');
  process.exit(1);
}

const PORT = process.env.PORT || 3002;

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('WebSocket auth failed: No token provided');
    }
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = verifyToken(token);
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`✓ WebSocket auth successful for user: ${socket.userId}`);
    }
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('WebSocket auth failed:', err.message);
    }
    next(new Error('Invalid authentication token'));
  }
});

// WebSocket connection handler
io.on('connection', (socket) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`✓ WebSocket client connected: ${socket.id} (User: ${socket.userId})`);
  }

  // Join game room for live updates
  socket.on('join-game', (gameId) => {
    socket.join(`game-${gameId}`);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`User ${socket.userId} joined game room: ${gameId}`);
    }
  });

  // Leave game room
  socket.on('leave-game', (gameId) => {
    socket.leave(`game-${gameId}`);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`User ${socket.userId} left game room: ${gameId}`);
    }
  });

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`✗ WebSocket client disconnected: ${socket.id}`);
    }
  });
});

// Make io accessible to other modules
app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket server ready for connections');
});