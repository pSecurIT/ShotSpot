-- Template for database setup
-- Copy this file to setup-db.sql and replace the placeholder values

-- Drop existing database and user if they exist
DROP DATABASE IF EXISTS shotspot_db;
DROP USER IF EXISTS shotspot_user;

-- Create new user and database
-- IMPORTANT: Replace 'your_secure_password_here' with a strong password
CREATE USER shotspot_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE shotspot_db WITH OWNER = shotspot_user;

-- Connect to the new database
\c shotspot_db

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE shotspot_db TO shotspot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shotspot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shotspot_user;

-- Note: After running this script, make sure to:
-- 1. Update the DB_PASSWORD in your .env file
-- 2. Run the schema.sql file to create the tables