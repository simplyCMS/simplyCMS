-- 22_collisions.sql — колізії slug між мовами й через fallback.
-- Сценарій S1: товар X (має en-переклад) отримує en-slug, що дорівнює uk-slug товару Y,
-- у якого en-перекладу НЕМАЄ. У локалі en вітрина показує Y за його uk-slug (fallback) —
-- отже URL /en/<slug> стає неоднозначним. Що скаже БД у кожній моделі?
-- Сценарій S2: той самий slug в іншій локалі (X.en = Y.uk, але Y має en-переклад) —
-- це НЕ колізія для маршрутизації (/en/<slug> однозначний), але глобальний реєстр її забороняє.
-- Запуск: фаза 1 — моделі A/B/D і реєстр; фаза 2 — R/R2 (змінна :phase).
CREATE TABLE IF NOT EXISTS bench.collisions (scale int, model text, scenario text, outcome text, detail text, PRIMARY KEY (scale, model, scenario));

DROP TABLE IF EXISTS bench.coll_pair;
CREATE TABLE bench.coll_pair AS
SELECT (SELECT t.product_id FROM a.product_translations t JOIN a.products p ON p.id = t.product_id AND p.is_active
        WHERE t.locale = 'en' AND t.slug IS NOT NULL ORDER BY md5(t.product_id::text) LIMIT 1) AS x,
       (SELECT p.id FROM a.products p WHERE p.is_active AND NOT EXISTS (SELECT 1 FROM a.product_translations t WHERE t.product_id = p.id AND t.locale = 'en')
        ORDER BY md5(p.id::text) LIMIT 1) AS y,
       (SELECT p.id FROM a.products p WHERE p.is_active AND EXISTS (SELECT 1 FROM a.product_translations t WHERE t.product_id = p.id AND t.locale = 'en' AND t.slug IS NOT NULL)
        ORDER BY md5(p.id::text) OFFSET 5 LIMIT 1) AS z;  -- z: має en-переклад (для S2)

-- природні колізії в згенерованих даних (перекладений slug = базовий slug іншого товару без перекладу в тій мові)
INSERT INTO bench.collisions
SELECT :scale, 'data', 'natural_fallback_collisions', count(*)::text, 'пар у згенерованому каталозі' FROM a.product_translations t
JOIN a.products p ON p.slug = t.slug AND p.id <> t.product_id
WHERE NOT EXISTS (SELECT 1 FROM a.product_translations t3 WHERE t3.product_id = p.id AND t3.locale = t.locale AND t3.slug IS NOT NULL)
ON CONFLICT (scale, model, scenario) DO UPDATE SET outcome = EXCLUDED.outcome;

CREATE OR REPLACE FUNCTION bench.try_collision(p_scale int, p_model text, p_scenario text, p_sql text, p_check text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE c record; outcome text; detail text; s text; who uuid;
BEGIN
  SELECT * INTO c FROM bench.coll_pair;
  BEGIN
    FOREACH s IN ARRAY string_to_array(format(p_sql, c.x, c.y, c.z), ';;') LOOP
      IF btrim(s) <> '' THEN EXECUTE s; END IF;
    END LOOP;
    outcome := 'ПРИЙНЯТО';
    IF p_check IS NOT NULL THEN
      EXECUTE format(p_check, c.x, c.y, c.z) INTO who;
      detail := CASE WHEN who = c.x THEN '/en/<slug> тепер веде на X; Y у локалі en недосяжний'
                     WHEN who = c.y THEN '/en/<slug> досі веде на Y' ELSE 'резолвер повернув ' || coalesce(who::text, 'NULL') END;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'rollback';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN NULL;
    WHEN unique_violation THEN outcome := 'ВІДХИЛЕНО БД'; detail := SQLERRM;
  END;
  INSERT INTO bench.collisions VALUES (p_scale, p_model, p_scenario, outcome, detail)
  ON CONFLICT (scale, model, scenario) DO UPDATE SET outcome = EXCLUDED.outcome, detail = EXCLUDED.detail;
END $$;
