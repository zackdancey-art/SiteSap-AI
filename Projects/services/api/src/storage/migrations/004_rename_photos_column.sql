-- Rename photos → photos_json in project_entries (migration 001 originally used the wrong name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_entries' AND column_name = 'photos'
  ) THEN
    ALTER TABLE project_entries RENAME COLUMN photos TO photos_json;
  END IF;
END $$;
