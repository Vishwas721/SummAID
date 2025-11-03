-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Create reports table
CREATE TABLE reports (
    report_id SERIAL PRIMARY KEY,
    patient_name TEXT NOT NULL,
    report_filepath_pointer TEXT NOT NULL,
    report_text_encrypted BYTEA NOT NULL
);

-- Create report_vectors table
CREATE TABLE report_vectors (
    report_id INTEGER REFERENCES reports(report_id) ON DELETE CASCADE,
    report_vector vector(768) NOT NULL,
    PRIMARY KEY (report_id)
);

-- Create index on the vector column for better performance
CREATE INDEX report_vectors_vector_idx ON report_vectors USING ivfflat (report_vector vector_cosine_ops);