-- Add chart preparation tracking and persistent summaries
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chart_prepared_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS patient_summaries (
    patient_id INTEGER PRIMARY KEY REFERENCES patients(patient_id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    patient_type TEXT,
    chief_complaint TEXT,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_summaries_generated_at ON patient_summaries(generated_at);