-- Add password_must_change column to users table
-- This flag forces users to change their password on first login

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS password_must_change BOOLEAN DEFAULT false;

COMMENT ON COLUMN users.password_must_change IS 'Forces user to change password on next login (used for default admin and password resets)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_password_must_change ON users(password_must_change) WHERE password_must_change = true;
