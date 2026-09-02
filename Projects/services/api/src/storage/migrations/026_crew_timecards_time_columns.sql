-- 026: add the timesheet time columns to crew_timecards.
--
-- crewStore.createTimecard has always INSERTed (and mapRow read) start_time,
-- end_time and break_minutes, but no migration — and no inline store schema —
-- ever created them. Every timecard INSERT against Postgres therefore failed
-- with `column "start_time" of relation "crew_timecards" does not exist`, which
-- the route flattened into a generic 500. It was invisible because the test
-- suite never exercised the Postgres write path (finding: crew_timecards column
-- drift; see docs/AUDIT.md). This migration makes the schema catch up to the code.
--
-- Types mirror what the store writes: startTime/endTime are strings (TEXT),
-- breakMinutes is a number (INTEGER, TimecardSchema clamps it 0..480). All three
-- are nullable — the INSERT passes NULL when the fields are absent — so this is
-- purely additive with no backfill and no NOT NULL constraint.
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS). crew_timecards is
-- FORCE ROW LEVEL SECURITY (025); ADD COLUMN is unaffected by RLS.

ALTER TABLE crew_timecards ADD COLUMN IF NOT EXISTS start_time    TEXT;
ALTER TABLE crew_timecards ADD COLUMN IF NOT EXISTS end_time      TEXT;
ALTER TABLE crew_timecards ADD COLUMN IF NOT EXISTS break_minutes INTEGER;
