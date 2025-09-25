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

  if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.length < 12) {
    insecure.push('DB_PASSWORD (too short, minimum 12 characters)');
  }

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
if (require.main === module) {
  validateEnvVars();
}

module.exports = validateEnvVars;