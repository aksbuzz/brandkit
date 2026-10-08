-- Apply once to a database that was created from the original schema.sql.
-- A fresh database created from the current schema.sql already contains these constraints.
--
--   psql -h <rds_endpoint> -U <user> -d <db> -f 0001_variant_uniqueness_and_preset_checks.sql
--
-- If the first statement fails with a duplicate key error, the worker already stored two rows for the
-- same (asset_id, preset_id). Keep the newest row for each pair and delete the rest, then re-run:
--   DELETE FROM variants v USING variants newer
--    WHERE v.asset_id = newer.asset_id AND v.preset_id = newer.preset_id AND v.created_at < newer.created_at;

BEGIN;

ALTER TABLE variants
  ADD CONSTRAINT variants_asset_preset_key UNIQUE (asset_id, preset_id);

ALTER TABLE presets
  ADD CONSTRAINT presets_width_positive CHECK (width > 0),
  ADD CONSTRAINT presets_height_positive CHECK (height > 0),
  ADD CONSTRAINT presets_format_allowed CHECK (format IN ('jpeg', 'webp', 'png'));

COMMIT;
