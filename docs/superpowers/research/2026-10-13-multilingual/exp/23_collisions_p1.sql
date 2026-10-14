-- 23_collisions_p1.sql — колізії для A, B, D + глобальний реєстр slug для A і його ціна
-- %1$L = X (має en), %2$L = Y (без en), %3$L = Z (має en)
\set chkA 'SELECT id FROM (SELECT product_id AS id FROM a.product_translations WHERE locale = ''en'' AND slug = (SELECT slug FROM a.products WHERE id = %2$L) UNION ALL SELECT p2.id FROM a.products p2 WHERE p2.slug = (SELECT slug FROM a.products WHERE id = %2$L) AND NOT EXISTS (SELECT 1 FROM a.product_translations t2 WHERE t2.product_id = p2.id AND t2.locale = ''en'' AND t2.slug IS NOT NULL)) s LIMIT 1'

SELECT bench.try_collision(:scale, 'A', 'S1_fallback', $s$UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %2$L) WHERE product_id = %1$L AND locale = 'en'$s$, :'chkA');
SELECT bench.try_collision(:scale, 'A', 'S2_cross_locale', $s$UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %3$L) WHERE product_id = %1$L AND locale = 'en'$s$);
SELECT bench.try_collision(:scale, 'A', 'S3_same_locale', $s$UPDATE a.product_translations SET slug = (SELECT slug FROM a.product_translations WHERE product_id = %3$L AND locale = 'en') WHERE product_id = %1$L AND locale = 'en'$s$);
SELECT bench.try_collision(:scale, 'B', 'S1_fallback', $s$UPDATE b.product_translations SET slug = (SELECT slug FROM b.product_translations WHERE product_id = %2$L AND locale = 'uk') WHERE product_id = %1$L AND locale = 'en'$s$,
  $c$SELECT id FROM (SELECT product_id AS id FROM b.product_translations WHERE locale = 'en' AND slug = (SELECT slug FROM b.product_translations WHERE product_id = %2$L AND locale = 'uk')
     UNION ALL SELECT t1.product_id FROM b.product_translations t1 WHERE t1.locale = 'uk' AND t1.slug = (SELECT slug FROM b.product_translations WHERE product_id = %2$L AND locale = 'uk')
       AND NOT EXISTS (SELECT 1 FROM b.product_translations t2 WHERE t2.product_id = t1.product_id AND t2.locale = 'en' AND t2.slug IS NOT NULL)) s LIMIT 1$c$);
SELECT bench.try_collision(:scale, 'B', 'S2_cross_locale', $s$UPDATE b.product_translations SET slug = (SELECT slug FROM b.product_translations WHERE product_id = %3$L AND locale = 'uk') WHERE product_id = %1$L AND locale = 'en'$s$);
SELECT bench.try_collision(:scale, 'B', 'S3_same_locale', $s$UPDATE b.product_translations SET slug = (SELECT slug FROM b.product_translations WHERE product_id = %3$L AND locale = 'en') WHERE product_id = %1$L AND locale = 'en'$s$);
SELECT bench.try_collision(:scale, 'D', 'S1_fallback', $s$UPDATE d.products SET slug = jsonb_set(slug, '{en}', (SELECT slug->'uk' FROM d.products WHERE id = %2$L)) WHERE id = %1$L$s$,
  $c$SELECT id FROM (SELECT p2.id FROM d.products p2 WHERE (p2.slug->>'en') = (SELECT slug->>'uk' FROM d.products WHERE id = %2$L) AND p2.slug ? 'en'
     UNION ALL SELECT p2.id FROM d.products p2 WHERE (p2.slug->>'uk') = (SELECT slug->>'uk' FROM d.products WHERE id = %2$L) AND NOT p2.slug ? 'en') s LIMIT 1$c$);
SELECT bench.try_collision(:scale, 'D', 'S2_cross_locale', $s$UPDATE d.products SET slug = jsonb_set(slug, '{en}', (SELECT slug->'uk' FROM d.products WHERE id = %3$L)) WHERE id = %1$L$s$);
SELECT bench.try_collision(:scale, 'D', 'S3_same_locale', $s$UPDATE d.products SET slug = jsonb_set(slug, '{en}', (SELECT slug->'en' FROM d.products WHERE id = %3$L)) WHERE id = %1$L$s$);

-- ---------- A + глобальний реєстр slug (один простір імен на тип сутності, усі мови) ----------
-- Правило: slug належить рівно одному товару в БУДЬ-ЯКІЙ мові; той самий товар може мати
-- однаковий slug у кількох мовах. Fallback-колізія стає неможливою за побудовою, маршрут
-- /{locale}/{slug} резолвиться одним index probe без NOT EXISTS. Реєстр append-only: старі
-- slug лишаються за товаром і слугують джерелом 301-редиректів.
-- базова лінія без реєстру: зміна slug одного перекладу (з відкатом)
SELECT bench.wseries(:scale, 'A', 'upd_slug_1', $s$
  UPDATE a.product_translations SET slug = slug || '-' || substr(md5(random()::text), 1, 4) WHERE product_id = %1$L AND locale = 'en' $s$, (SELECT ids FROM bench.w_ids), NULL, true);
CREATE TABLE a.product_slug_registry (slug varchar(255) PRIMARY KEY, product_id uuid NOT NULL REFERENCES a.products(id) ON DELETE CASCADE);
\timing on
INSERT INTO a.product_slug_registry SELECT DISTINCT ON (slug) slug, product_id FROM (
  SELECT slug, id AS product_id FROM a.products UNION ALL SELECT slug, product_id FROM a.product_translations WHERE slug IS NOT NULL) x;
\timing off
CREATE OR REPLACE FUNCTION a.claim_slug(p_slug text, p_pid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE owner uuid;
BEGIN
  IF p_slug IS NULL THEN RETURN; END IF;
  INSERT INTO a.product_slug_registry (slug, product_id) VALUES (p_slug, p_pid)
  ON CONFLICT (slug) DO UPDATE SET product_id = a.product_slug_registry.product_id  -- no-op, щоб повернути власника
  RETURNING product_id INTO owner;
  IF owner <> p_pid THEN
    RAISE EXCEPTION USING ERRCODE = 'unique_violation', MESSAGE = format('slug "%s" уже належить товару %s', p_slug, owner);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION a.claim_slug_tr() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM a.claim_slug(NEW.slug, NEW.product_id); RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION a.claim_slug_p() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM a.claim_slug(NEW.slug, NEW.id); RETURN NULL; END $$;
CREATE TRIGGER claim_slug AFTER INSERT OR UPDATE OF slug ON a.product_translations FOR EACH ROW EXECUTE FUNCTION a.claim_slug_tr();
CREATE TRIGGER claim_slug AFTER INSERT OR UPDATE OF slug ON a.products FOR EACH ROW EXECUTE FUNCTION a.claim_slug_p();

SELECT bench.try_collision(:scale, 'A+registry', 'S1_fallback', $s$UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %2$L) WHERE product_id = %1$L AND locale = 'en'$s$);
SELECT bench.try_collision(:scale, 'A+registry', 'S2_cross_locale', $s$UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %3$L) WHERE product_id = %1$L AND locale = 'en'$s$);
SELECT bench.try_collision(:scale, 'A+registry', 'S3_same_locale', $s$UPDATE a.product_translations SET slug = (SELECT slug FROM a.product_translations WHERE product_id = %3$L AND locale = 'en') WHERE product_id = %1$L AND locale = 'en'$s$);

-- ціна реєстру на записі
CHECKPOINT;
SELECT 'A+registry add_locale_10k' t, * FROM bench.wbulk(:scale, 'A+registry', 'add_locale_10k', $s$
  INSERT INTO a.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
  SELECT product_id, 'cs', name, slug, short_description, description, meta_title, meta_description FROM bench.import_cs
  ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, short_description = EXCLUDED.short_description,
    description = EXCLUDED.description, meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description $s$,
  'row-level тригер claim_slug на кожен рядок');
SELECT bench.wseries(:scale, 'A+registry', 'upd_tr_en', $s$
  UPDATE a.product_translations SET name = name || ' x', description = description || ' x' WHERE product_id = %1$L AND locale = 'en';;
  UPDATE a.products SET updated_at = now() WHERE id = %1$L $s$, (SELECT ids FROM bench.w_ids), 'slug не змінюється — тригер UPDATE OF slug не спрацьовує');
SELECT bench.wseries(:scale, 'A+registry', 'upd_slug_1', $s$
  UPDATE a.product_translations SET slug = slug || '-' || substr(md5(random()::text), 1, 4) WHERE product_id = %1$L AND locale = 'en' $s$, (SELECT ids FROM bench.w_ids), NULL, true);
SELECT 'registry size' AS what, pg_size_pretty(pg_total_relation_size('a.product_slug_registry')) AS size, (SELECT count(*) FROM a.product_slug_registry) AS rows;
-- прибрати реєстр, щоб фаза 2 будувалась на «чистій» A
DROP TABLE a.product_slug_registry CASCADE; DROP TRIGGER claim_slug ON a.product_translations; DROP TRIGGER claim_slug ON a.products; DROP FUNCTION a.claim_slug_tr(), a.claim_slug_p(), a.claim_slug(text, uuid);
SELECT * FROM bench.collisions WHERE scale = :scale ORDER BY model, scenario;
