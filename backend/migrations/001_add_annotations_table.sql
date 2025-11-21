-- Migration: Add annotations table for doctor notes
-- Created: 2025-11-21

CREATE TABLE IF NOT EXISTS annotations (
    annotation_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient patient lookup
CREATE INDEX IF NOT EXISTS idx_annotations_patient_id ON annotations(patient_id);
CREATE INDEX IF NOT EXISTS idx_annotations_created_at ON annotations(created_at DESC);
