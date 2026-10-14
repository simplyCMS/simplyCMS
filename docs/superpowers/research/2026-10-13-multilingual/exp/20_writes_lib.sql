-- 20_writes_lib.sql — вимірювання записів: час, обсяг WAL і «які таблиці зачеплено».
-- WAL — головна метрика «скільки байтів переписує модель»: на реплікацію, бекап і
-- I/O його платять у проді незалежно від tmpfs. Масові операції виконуються в
-- субтранзакції, що відкочується (дані лишаються незмінними для наступних тестів).
CREATE TABLE IF NOT EXISTS bench.writes (
  scale int, model text, test text, n int, ms_median float8, ms_total float8,
  wal_bytes_median numeric, wal_bytes_total numeric, touched jsonb, note text,
  PRIMARY KEY (scale, model, test)
);

-- Один прогін SQL-скрипту (може містити кілька операторів через ';') з відкатом або без.
CREATE OR REPLACE FUNCTION bench.wone(p_sql text, p_rollback boolean, OUT ms float8, OUT wal numeric, OUT touched jsonb)
LANGUAGE plpgsql AS $$
DECLARE t0 timestamptz; l0 pg_lsn; s text; before jsonb;
BEGIN
  -- pg_stat_xact_* у PG15+ показує ще не скинуті лічильники і попередніх транзакцій — тому різниця
  SELECT coalesce(jsonb_object_agg(schemaname || '.' || relname, jsonb_build_array(n_tup_ins, n_tup_upd, n_tup_hot_upd, n_tup_del)), '{}')
    INTO before FROM pg_stat_xact_user_tables WHERE schemaname <> 'bench';
  BEGIN
    l0 := pg_current_wal_insert_lsn(); t0 := clock_timestamp();
    FOREACH s IN ARRAY string_to_array(p_sql, ';;') LOOP
      IF btrim(s) <> '' THEN EXECUTE s; END IF;
    END LOOP;
    ms := extract(epoch FROM clock_timestamp() - t0) * 1000;
    wal := pg_wal_lsn_diff(pg_current_wal_insert_lsn(), l0);
    SELECT jsonb_object_agg(k, jsonb_build_object('ins', ins, 'upd', upd, 'hot', hot, 'del', del)) INTO touched FROM (
      SELECT x.schemaname || '.' || x.relname AS k,
             x.n_tup_ins - coalesce((before -> (x.schemaname || '.' || x.relname) ->> 0)::bigint, 0) AS ins,
             x.n_tup_upd - coalesce((before -> (x.schemaname || '.' || x.relname) ->> 1)::bigint, 0) AS upd,
             x.n_tup_hot_upd - coalesce((before -> (x.schemaname || '.' || x.relname) ->> 2)::bigint, 0) AS hot,
             x.n_tup_del - coalesce((before -> (x.schemaname || '.' || x.relname) ->> 3)::bigint, 0) AS del
      FROM pg_stat_xact_user_tables x WHERE x.schemaname <> 'bench') d WHERE ins + upd + del > 0;
    IF p_rollback THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'bench-rollback'; END IF;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;  -- змінні plpgsql не відкочуються — заміри зберігаються
  END;
END $$;

-- Серія однотипних операцій (по одній на id), медіана часу й WAL; без відкату.
CREATE OR REPLACE FUNCTION bench.wseries(p_scale int, p_model text, p_test text, p_sql text, p_ids uuid[], p_note text DEFAULT NULL, p_rollback boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE id uuid; r record; ms float8[] := '{}'; wal numeric[] := '{}'; last_touched jsonb;
BEGIN
  -- прогрів: перший дотик сторінки після checkpoint пише full-page image (8 КБ), що топить
  -- різницю між моделями; міряємо другий прохід — «сталий» WAL самого рядка/індексів
  FOREACH id IN ARRAY p_ids LOOP PERFORM bench.wone(format(p_sql, id), p_rollback); END LOOP;
  FOREACH id IN ARRAY p_ids LOOP
    SELECT * INTO r FROM bench.wone(format(p_sql, id), p_rollback);
    ms := ms || r.ms; wal := wal || r.wal; last_touched := r.touched;
  END LOOP;
  INSERT INTO bench.writes VALUES (p_scale, p_model, p_test, cardinality(p_ids),
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY x) FROM unnest(ms) x), (SELECT sum(x) FROM unnest(ms) x),
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY x) FROM unnest(wal) x), (SELECT sum(x) FROM unnest(wal) x), last_touched, p_note)
  ON CONFLICT (scale, model, test) DO UPDATE SET n = EXCLUDED.n, ms_median = EXCLUDED.ms_median, ms_total = EXCLUDED.ms_total,
    wal_bytes_median = EXCLUDED.wal_bytes_median, wal_bytes_total = EXCLUDED.wal_bytes_total, touched = EXCLUDED.touched, note = EXCLUDED.note;
END $$;

-- Масова операція з відкатом; перед нею CHECKPOINT не робимо (не можна в функції) —
-- його робить скрипт-викликач, щоб full-page writes були однаковими для всіх моделей.
CREATE OR REPLACE FUNCTION bench.wbulk(p_scale int, p_model text, p_test text, p_sql text, p_note text DEFAULT NULL)
RETURNS TABLE (ms float8, wal_mb numeric) LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM bench.wone(p_sql, true);
  INSERT INTO bench.writes VALUES (p_scale, p_model, p_test, 1, r.ms, r.ms, r.wal, r.wal, r.touched, p_note)
  ON CONFLICT (scale, model, test) DO UPDATE SET ms_median = EXCLUDED.ms_median, ms_total = EXCLUDED.ms_total,
    wal_bytes_median = EXCLUDED.wal_bytes_median, wal_bytes_total = EXCLUDED.wal_bytes_total, touched = EXCLUDED.touched, note = EXCLUDED.note;
  RETURN QUERY SELECT r.ms, round(r.wal / 1048576.0, 1);
END $$;
