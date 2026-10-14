-- 34_collisions_r.sql — S1/S2/S3 для R і R2: проєкція з fallback має UNIQUE(locale, slug)
\set chkR 'SELECT product_id FROM r.catalog_entries WHERE locale = ''en'' AND slug = (SELECT slug FROM a.products WHERE id = %2$L)'
SELECT bench.try_collision(:scale, 'R (синхронно)', 'S1_fallback', $s$
  UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %2$L) WHERE product_id = %1$L AND locale = 'en';;
  INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries WHERE product_id = %1$L AND locale = 'en'
    ON CONFLICT (product_id, locale) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name $s$);
SELECT bench.try_collision(:scale, 'R (синхронно)', 'S2_cross_locale', $s$
  UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %3$L) WHERE product_id = %1$L AND locale = 'en';;
  INSERT INTO r.catalog_entries SELECT * FROM r.v_catalog_entries WHERE product_id = %1$L AND locale = 'en'
    ON CONFLICT (product_id, locale) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name $s$);
SELECT * FROM bench.collisions WHERE scale = :scale ORDER BY model, scenario;
