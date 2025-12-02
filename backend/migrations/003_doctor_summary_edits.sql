-- Migration: Doctor Summary Edits (Revision History)
-- Purpose: Allow doctors to edit Medical Journey and Action Plan sections
-- while preserving full revision history (append-only)

CREATE TABLE IF NOT EXISTS doctor_summary_edits (
    edit_id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK(section IN ('medical_journey', 'action_plan')),
    content TEXT NOT NULL,
    edited_by TEXT NOT NULL,  -- Doctor username or user_id
    edited_at TIMESTAMP DEFAULT NOW(),
    
    -- Index for fast retrieval of latest edits per patient/section
    CONSTRAINT idx_patient_section_time UNIQUE (patient_id, section, edited_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doctor_edits_patient_id ON doctor_summary_edits(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_edits_section ON doctor_summary_edits(patient_id, section);
CREATE INDEX IF NOT EXISTS idx_doctor_edits_time ON doctor_summary_edits(edited_at DESC);

-- Comment for documentation
COMMENT ON TABLE doctor_summary_edits IS 'Append-only revision history for doctor edits to AI-generated summaries';
COMMENT ON COLUMN doctor_summary_edits.section IS 'Either medical_journey (evolution) or action_plan (current_status + plan)';
COMMENT ON COLUMN doctor_summary_edits.content IS 'Doctor-edited text content for the section';
