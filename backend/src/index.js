import dotenv from 'dotenv';

// NOTE: In ESM, static imports are evaluated before this file's top-level code.
// To ensure environment variables are loaded before modules that depend on
// them, we load dotenv here and then use dynamic imports for env-dependent
// modules (app, auth, db, validateEnv, initDefaultAdmin).
if (process.env.NODE_ENV === 'test') {
  // For tests, load test env if present
  const { existsSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const envTestPath = fileURLToPath(new URL('./.env.test', import.meta.url));
  if (existsSync(envTestPath)) {
    const parsed = dotenv.parse(readFileSync(envTestPath));
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  }
} else if (process.env.NODE_ENV !== 'production') {
  // Development: load root .env then backend overrides if unset. Do NOT
  // force-override environment variables provided by Docker/Compose so
  // runtime settings (like DB_HOST) remain authoritative when running
  // in containers that inject env values.
  const { existsSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');

  const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
  const backendEnvPath = fileURLToPath(new URL('../.env', import.meta.url));

  /**
   * Track where each env var came from so we can allow backend/.env
   * to override values from root .env, without overriding OS/Docker env.
   */
  const envSource = new Map();

  const applyParsedEnv = (parsed, source, allowOverrideFromRoot = false) => {
    for (const [key, value] of Object.entries(parsed)) {
      const isUnset = process.env[key] === undefined;
      const wasFromRoot = envSource.get(key) === 'root';
      const canOverride = allowOverrideFromRoot && wasFromRoot;

      if (isUnset || canOverride) {
        process.env[key] = value;
        envSource.set(key, source);
      }
    }
  };

  if (existsSync(rootEnvPath)) {
    applyParsedEnv(dotenv.parse(readFileSync(rootEnvPath)), 'root');
  }
  if (existsSync(backendEnvPath)) {
    applyParsedEnv(dotenv.parse(readFileSync(backendEnvPath)), 'backend', true);
  }
} else {
  // Production: do not load local .env files so docker/compose env vars win
  console.log('NODE_ENV=production — using container environment variables');
}

import { createServer } from 'http';
import { Server } from 'socket.io';

const [{ default: validateEnv }, { default: app }, authModule, { default: db }, initAdminModule] =
  await Promise.all([
    import('./utils/validateEnv.js'),
    import('./app.js'),
    import('./middleware/auth.js'),
    import('./db.js'),
    import('../scripts/init-default-admin.js')
  ]);

const { verifyToken } = authModule;
const initDefaultAdmin = initAdminModule.default;

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

const socketAllowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

const io = new Server(httpServer, {
  cors: {
    origin: socketAllowedOrigins,
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