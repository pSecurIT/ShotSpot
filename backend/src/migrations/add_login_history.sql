-- Add login history tracking table
CREATE TABLE IF NOT EXISTS login_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_success ON login_history(success);

COMMENT ON TABLE login_history IS 'Tracks all login attempts (successful and failed) for security auditing';
COMMENT ON COLUMN login_history.success IS 'True if login was successful, false otherwise';
COMMENT ON COLUMN login_history.ip_address IS 'IP address of the login attempt';
COMMENT ON COLUMN login_history.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN login_history.error_message IS 'Error message if login failed (e.g., invalid password, user not found)';
