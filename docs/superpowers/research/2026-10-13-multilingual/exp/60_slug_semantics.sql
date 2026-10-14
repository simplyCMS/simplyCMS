\set ON_ERROR_STOP 0
\pset pager off
CREATE TABLE languages(code text PRIMARY KEY, is_default bool NOT NULL DEFAULT false, is_active bool NOT NULL DEFAULT true);
CREATE UNIQUE INDEX ON languages(is_default) WHERE is_default;
CREATE TABLE products(id int PRIMARY KEY, source_locale text NOT NULL, name text NOT NULL, slug text NOT NULL UNIQUE);
CREATE TABLE product_translations(product_id int REFERENCES products, locale text, name text, slug text,
  PRIMARY KEY(product_id, locale), UNIQUE(locale, slug));
CREATE TABLE catalog_text(product_id int, locale text, slug text NOT NULL, status text NOT NULL,
  PRIMARY KEY(product_id, locale), UNIQUE(locale, slug));
-- ланцюжок рішення 50 §2.3: запитана → основна вітрини → джерело
CREATE FUNCTION rebuild_text(pid int) RETURNS void LANGUAGE sql AS $$
  DELETE FROM catalog_text WHERE product_id = pid;
  INSERT INTO catalog_text
  SELECT p.id, l.code,
         coalesce(t.slug, CASE WHEN p.source_locale = l.code THEN p.slug END, td.slug, p.slug),
         CASE WHEN t.slug IS NOT NULL OR p.source_locale = l.code THEN 'translated' ELSE 'fallback' END
  FROM products p CROSS JOIN languages l
  LEFT JOIN product_translations t ON t.product_id=p.id AND t.locale=l.code
  LEFT JOIN product_translations td ON td.product_id=p.id AND td.locale=(SELECT code FROM languages WHERE is_default)
  WHERE p.id = pid AND l.is_active;
$$;
CREATE FUNCTION rebuild_all() RETURNS void LANGUAGE sql AS $$
  DELETE FROM catalog_text; SELECT rebuild_text(id) FROM products; $$;

INSERT INTO languages VALUES ('uk', true), ('en', false);
INSERT INTO products VALUES (1,'uk','Панель X','paneli-x'), (2,'uk','Панель Y','paneli-y'), (3,'en','Panel Z','panel-z');
INSERT INTO product_translations VALUES (1,'en','Panel X','panel');
SELECT rebuild_all();
\echo '== стан'
SELECT * FROM catalog_text ORDER BY locale, product_id;

\echo '== S-A: нова мова pl з 0% перекладів — колізій немає?'
BEGIN; INSERT INTO languages VALUES ('pl', false); SELECT rebuild_all(); SELECT locale, count(*) FROM catalog_text GROUP BY 1 ORDER BY 1; COMMIT;

\echo '== S-B: 1С (лише uk) перейменовує slug джерела товару 2 на "panel" — в uk вільний'
BEGIN;
UPDATE products SET slug='panel' WHERE id=2;           -- джерело uk: UNIQUE products.slug пропускає
SELECT rebuild_text(2);                                -- синхронна проєкція в тій самій транзакції
ROLLBACK;

\echo '== S-C: зміна основної мови uk -> en при частковому перекладі pl'
INSERT INTO product_translations VALUES (2,'en','Panel Y','shared');
INSERT INTO product_translations VALUES (1,'pl','Panel X pl','shared');
SELECT rebuild_all();
SELECT * FROM catalog_text WHERE locale='pl' ORDER BY product_id;
BEGIN;
UPDATE languages SET is_default=false WHERE code='uk';
UPDATE languages SET is_default=true WHERE code='en';
SELECT rebuild_all();
ROLLBACK;

\echo '== S-D: переклад з locale = source_locale (uk для товару 1) — куди писати?'
INSERT INTO product_translations VALUES (1,'uk','Інша назва','inshyi-slug');
SELECT rebuild_text(1);
SELECT p.slug AS base_slug, t.slug AS overlay_uk, c.slug AS projected FROM products p
 JOIN product_translations t ON t.product_id=p.id AND t.locale='uk' JOIN catalog_text c ON c.product_id=p.id AND c.locale='uk' WHERE p.id=1;

\echo '== S-E: товар із source_locale=en; основна uk; 1С шле uk-текст "тілом джерела" — без локалі в запиті'
UPDATE products SET name='Панель Z (українською від 1С)' WHERE id=3;
SELECT id, source_locale, name FROM products WHERE id=3;
