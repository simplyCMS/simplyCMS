-- 32_collisions_r2.sql — S1/S2/S3 для R і R2: проєкція з fallback має UNIQUE(locale, slug)
\set chkR 'SELECT product_id FROM r.catalog_entries WHERE locale = ''en'' AND slug = (SELECT slug FROM a.products WHERE id = %2$L)'
SELECT bench.try_collision(:scale, 'R2 cat_text (синхронно)', 'S1_fallback', $s$
  UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %2$L) WHERE product_id = %1$L AND locale = 'en';;
  INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text WHERE product_id = %1$L AND locale = 'en'
    ON CONFLICT (product_id, locale) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name $s$);
-- зворотний бік fallback-реєстру: Y отримує en-переклад зі slug, що збігається з uk-slug X,
-- а X у en перекладений (тобто /en/<uk-slug-X> вільний) — колізії немає, має пройти
SELECT bench.try_collision(:scale, 'R2 cat_text (синхронно)', 'S2_cross_locale', $s$
  UPDATE a.product_translations SET slug = (SELECT slug FROM a.products WHERE id = %3$L) WHERE product_id = %1$L AND locale = 'en';;
  INSERT INTO r2.cat_text SELECT product_id, locale, name, slug FROM core.v_product_text WHERE product_id = %1$L AND locale = 'en'
    ON CONFLICT (product_id, locale) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name $s$);
SELECT * FROM bench.collisions WHERE scale = :scale ORDER BY model, scenario;
