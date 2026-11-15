-- db-autorestore.sql — idempotent restore point, run at stack start.
-- Restores `public` from the frozen `snapshot` schema ONLY when
-- public.operator_users is empty (i.e. the database was wiped/reset).
-- Normal restarts with live data are a no-op. Safe to run repeatedly.

\set ON_ERROR_STOP on

DO $$
DECLARE
  stmt      text;
  tbl       text;
  cols      text;
  rec       record;
  pub_users int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'snapshot') THEN
    RAISE NOTICE '[db-autorestore] no snapshot schema found — nothing to restore, skipping.';
    RETURN;
  END IF;

  IF to_regclass('public.operator_users') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.operator_users' INTO pub_users;
    IF pub_users > 0 THEN
      RAISE NOTICE '[db-autorestore] public.operator_users already populated (% rows) — skipping restore.', pub_users;
      RETURN;
    END IF;
  END IF;

  RAISE NOTICE '[db-autorestore] public schema is empty — restoring from snapshot...';

  -- Wipe whatever partial data exists (e.g. cold-start synthetic rows).
  SELECT 'TRUNCATE TABLE ' || string_agg(format('public.%I', table_name), ', ') || ' CASCADE'
    INTO stmt
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  IF stmt IS NOT NULL THEN
    EXECUTE stmt;
  END IF;

  -- Copy each snapshot table back; column list = intersection of both sides,
  -- so it survives later schema additions (new columns get their defaults).
  FOR tbl IN
    SELECT s.table_name
    FROM information_schema.tables s
    WHERE s.table_schema = 'snapshot' AND s.table_type = 'BASE TABLE' AND s.table_name <> '_meta'
      AND EXISTS (SELECT 1 FROM information_schema.tables p
                  WHERE p.table_schema = 'public' AND p.table_name = s.table_name)
  LOOP
    SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO cols
      FROM information_schema.columns c
     WHERE c.table_schema = 'snapshot' AND c.table_name = tbl
       AND EXISTS (SELECT 1 FROM information_schema.columns pc
                   WHERE pc.table_schema = 'public' AND pc.table_name = tbl
                     AND pc.column_name = c.column_name);
    IF cols IS NOT NULL THEN
      EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM snapshot.%I', tbl, cols, cols, tbl);
      RAISE NOTICE '[db-autorestore] restored %', tbl;
    END IF;
  END LOOP;

  -- Reset serial/identity sequences so new inserts do not collide with restored ids.
  FOR rec IN
    SELECT c.table_name AS t, c.column_name AS c
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, %L)::regclass, COALESCE((SELECT MAX(%I) FROM public.%I), 1))',
      'public.' || rec.t, rec.c, rec.c, rec.t);
  END LOOP;

  RAISE NOTICE '[db-autorestore] restore complete.';
END $$;
