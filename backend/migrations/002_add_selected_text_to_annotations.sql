-- Migration: Add selected_text column to annotations table
-- Created: 2025-11-22
-- Purpose: Support text highlighting annotations

ALTER TABLE annotations 
ADD COLUMN IF NOT EXISTS selected_text TEXT;

-- Create index for searching by selected text
CREATE INDEX IF NOT EXISTS idx_annotations_selected_text ON annotations(selected_text);
