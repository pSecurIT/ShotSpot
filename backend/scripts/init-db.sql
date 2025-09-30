-- Create the database if it doesn't exist
CREATE DATABASE shotspot;

-- Connect to the database
\c shotspot

-- Create the user with a password
CREATE USER shotspot_user WITH PASSWORD 'your_secure_password';

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE shotspot TO shotspot_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shotspot_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shotspot_user;

-- Create users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grant privileges on the users table
GRANT ALL PRIVILEGES ON TABLE users TO shotspot_user;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO shotspot_user;