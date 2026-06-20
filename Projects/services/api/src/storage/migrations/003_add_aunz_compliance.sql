-- AU/NZ compliance fields for project_entries
-- swms_ref:    Safe Work Method Statement reference number
-- hazard_notes: Site hazard observations recorded at time of entry
-- toolbox_talk: Whether a toolbox talk was conducted for this work period
ALTER TABLE project_entries
  ADD COLUMN IF NOT EXISTS swms_ref TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hazard_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS toolbox_talk BOOLEAN NOT NULL DEFAULT false;
