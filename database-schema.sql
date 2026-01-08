-- VetRecord Pro Database Schema
-- This script creates the required database tables for the veterinary consultation management application

-- Drop tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table (required for authentication)
CREATE TABLE users (
    id VARCHAR PRIMARY KEY NOT NULL,
    email VARCHAR UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    profile_image_url VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sessions table (required for session storage)
CREATE TABLE sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Create index on session expiration for cleanup
CREATE INDEX IDX_session_expire ON sessions(expire);

-- Create customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    address TEXT,
    pet_name VARCHAR,
    pet_breed VARCHAR,
    pet_age VARCHAR,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create consultations table
CREATE TABLE consultations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name VARCHAR NOT NULL,
    patient_id VARCHAR,
    pet_name VARCHAR,
    audio_url VARCHAR,
    file_name VARCHAR,
    duration INTEGER,
    full_transcription TEXT,
    ai_soap_note TEXT,
    final_soap_note TEXT,
    is_finalized BOOLEAN DEFAULT FALSE,
    status VARCHAR DEFAULT 'processing',
    recorded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_consultations_user_id ON consultations(user_id);
CREATE INDEX idx_consultations_customer_id ON consultations(customer_id);
CREATE INDEX idx_consultations_status ON consultations(status);

-- Grant permissions (adjust as needed for your database setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_database_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_database_user;
