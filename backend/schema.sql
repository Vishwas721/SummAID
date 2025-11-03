-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create reports table with non-PHI identifier
CREATE TABLE reports (
    report_id SERIAL PRIMARY KEY,
    patient_demo_id TEXT NOT NULL,  -- Non-PHI identifier (e.g., "patient_jane_doe")
    report_filepath_pointer TEXT NOT NULL,
    report_text_encrypted BYTEA NOT NULL
);

-- Create report_chunks table for RAG optimization
CREATE TABLE report_chunks (
    chunk_id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES reports(report_id) ON DELETE CASCADE,
    chunk_text_encrypted BYTEA NOT NULL,
    report_vector vector(768) NOT NULL,
    source_metadata JSONB NOT NULL  -- Stores {'page': X, 'chunk_index': Y} for citations
);