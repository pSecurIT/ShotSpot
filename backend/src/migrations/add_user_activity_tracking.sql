-- Migration: Add user activity tracking and soft delete support
-- Description: Adds is_active flag for soft deletion and last_login timestamp for activity tracking

-- Add is_active column (default true) to enable soft deletion
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Add last_login column to track user activity
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Create index on is_active for efficient filtering of active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Create index on last_login for activity queries
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Update existing users to set is_active = true if NULL
UPDATE users
SET is_active = TRUE
WHERE is_active IS NULL;
