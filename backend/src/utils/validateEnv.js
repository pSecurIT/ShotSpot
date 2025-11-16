const requiredEnvVars = {
  server: [
    'PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_MAX_CONNECTIONS',
    'DB_IDLE_TIMEOUT_MS',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'CORS_ORIGIN',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX'
  ]
};

function validateEnvVars() {
  const missing = [];
  const insecure = [];

  // Check for missing variables
  for (const envVar of requiredEnvVars.server) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check for insecure values
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    insecure.push('JWT_SECRET (too short, minimum 32 characters)');
  }

  // Validate database password
  if (!process.env.DB_PASSWORD) {
    insecure.push('DB_PASSWORD is required');
  } else if (typeof process.env.DB_PASSWORD !== 'string') {
    insecure.push('DB_PASSWORD must be a string');
  } else if (process.env.DB_PASSWORD.length < 12) {
    insecure.push('DB_PASSWORD (too short, minimum 12 characters)');
  }
  
  // Log database configuration for debugging
  console.log('Database configuration validation:', {
    DB_USER: process.env.DB_USER,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    hasPassword: !!process.env.DB_PASSWORD,
    passwordType: typeof process.env.DB_PASSWORD
  });

  // Validate numeric values
  const numericVars = ['PORT', 'DB_PORT', 'DB_MAX_CONNECTIONS', 'DB_IDLE_TIMEOUT_MS', 'RATE_LIMIT_MAX'];
  for (const envVar of numericVars) {
    if (process.env[envVar] && isNaN(parseInt(process.env[envVar]))) {
      insecure.push(`${envVar} (must be a number)`);
    }
  }

  // Check CORS origin format
  if (process.env.CORS_ORIGIN && !process.env.CORS_ORIGIN.startsWith('http')) {
    insecure.push('CORS_ORIGIN (must be a valid URL starting with http:// or https://)');
  }

  // Validate default admin credentials (if provided)
  if (process.env.DEFAULT_ADMIN_USERNAME) {
    const username = process.env.DEFAULT_ADMIN_USERNAME.trim();
    if (username.length < 3 || username.length > 50) {
      insecure.push('DEFAULT_ADMIN_USERNAME (must be between 3 and 50 characters)');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      insecure.push('DEFAULT_ADMIN_USERNAME (only alphanumeric, underscore, and hyphen allowed)');
    }
  }

  if (process.env.DEFAULT_ADMIN_EMAIL) {
    const email = process.env.DEFAULT_ADMIN_EMAIL.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      insecure.push('DEFAULT_ADMIN_EMAIL (invalid email format)');
    }
  }

  if (process.env.DEFAULT_ADMIN_PASSWORD && process.env.DEFAULT_ADMIN_PASSWORD.trim() !== '') {
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    if (password.length < 8) {
      insecure.push('DEFAULT_ADMIN_PASSWORD (minimum 8 characters required)');
    }
    if (!/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9])/.test(password)) {
      insecure.push('DEFAULT_ADMIN_PASSWORD (must include uppercase, lowercase, number, and special character)');
    }
    console.warn('⚠️  DEFAULT_ADMIN_PASSWORD is set. Consider leaving it empty for auto-generation.');
  }

  // Report findings
  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    console.error(missing.join('\n'));
    process.exit(1);
  }

  if (insecure.length > 0) {
    console.error('Insecure environment variable configurations:');
    console.error(insecure.join('\n'));
    process.exit(1);
  }

  console.log('Environment validation passed successfully!');
  return true;
}

// Execute validation if this file is run directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateEnvVars();
}

export default validateEnvVars;