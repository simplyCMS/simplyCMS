-- 24_migration.sql — вартість зміни моделі ПІЗНІШЕ, на живих даних (усе в транзакції з ROLLBACK).
-- A→B: перенести тексти основної мови з базових таблиць у *_translations і прибрати колонки.
-- B→A: зворотно — додати колонки, заповнити з рядків uk, видалити рядки uk.
-- Для кожного кроку — час (\timing) і тип блокування (у коментарі).
\timing on
\echo '======== A -> B (in-place у схемі a) ========'
CHECKPOINT;
BEGIN;
SELECT pg_current_wal_insert_lsn() AS l0 \gset
\echo '-- 1. товари: рядки uk у product_translations (ROW EXCLUSIVE — читання й запис інших рядків не блокує)'
INSERT INTO a.product_translations (product_id, locale, name, slug, short_description, description, meta_title, meta_description)
SELECT id, 'uk', name, slug, short_description, description, meta_title, meta_description FROM a.products;
\echo '-- 2. модифікації'
INSERT INTO a.product_modification_translations (modification_id, locale, name) SELECT id, 'uk', name FROM a.product_modifications;
\echo '-- 3. розділи, властивості, опції'
INSERT INTO a.section_translations SELECT id, 'uk', name, slug, description, meta_title, meta_description FROM a.sections;
INSERT INTO a.section_property_translations SELECT id, 'uk', name, slug FROM a.section_properties;
INSERT INTO a.property_option_translations SELECT id, 'uk', property_id, name, slug FROM a.property_options;
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), :'l0')) AS wal_after_copy;
\echo '-- 4. прибрати колонки (ACCESS EXCLUSIVE, але лише метадані — мілісекунди)'
DROP VIEW IF EXISTS core.v_product_attrs, core.v_product_text;  -- представлення індексатора читають колонки; у реальній міграції їх перевизначають
ALTER TABLE a.products DROP COLUMN name, DROP COLUMN slug, DROP COLUMN short_description, DROP COLUMN description, DROP COLUMN meta_title, DROP COLUMN meta_description;
ALTER TABLE a.product_modifications DROP COLUMN name;
ALTER TABLE a.sections DROP COLUMN name, DROP COLUMN slug, DROP COLUMN description, DROP COLUMN meta_title, DROP COLUMN meta_description;
ALTER TABLE a.section_properties DROP COLUMN name, DROP COLUMN slug;
ALTER TABLE a.property_options DROP COLUMN name, DROP COLUMN slug;
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), :'l0')) AS wal_total_a_to_b;
ROLLBACK;
\echo '-- 5. (опційно) повернути місце: VACUUM FULL a.products — ACCESS EXCLUSIVE на час перезапису (= вікно простою для таблиці)'
VACUUM FULL a.products;

\echo '======== B -> A (in-place у схемі b) ========'
CHECKPOINT;
BEGIN;
SELECT pg_current_wal_insert_lsn() AS l0 \gset
\echo '-- 1. додати колонки (ACCESS EXCLUSIVE, метадані — миттєво)'
ALTER TABLE b.products ADD COLUMN name text, ADD COLUMN slug varchar(255), ADD COLUMN short_description text, ADD COLUMN description text, ADD COLUMN meta_title text, ADD COLUMN meta_description text;
\echo '-- 2. заповнити з рядків uk: UPDATE 50k (ROW EXCLUSIVE + рядкові блокування; читачі не блокуються, паралельні правки тих самих товарів чекають)'
UPDATE b.products p SET name = t.name, slug = t.slug, short_description = t.short_description, description = t.description, meta_title = t.meta_title, meta_description = t.meta_description
FROM b.product_translations t WHERE t.product_id = p.id AND t.locale = 'uk';
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), :'l0')) AS wal_after_update;
\echo '-- 3. NOT NULL (ACCESS EXCLUSIVE + повний скан) і UNIQUE(slug) (SHARE-блок на час побудови індексу; онлайн — CREATE UNIQUE INDEX CONCURRENTLY)'
ALTER TABLE b.products ALTER COLUMN name SET NOT NULL, ALTER COLUMN slug SET NOT NULL;
ALTER TABLE b.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
\echo '-- 4. зняти FK на рядок uk і видалити рядки uk'
ALTER TABLE b.products DROP CONSTRAINT products_default_tr_fk;
DELETE FROM b.product_translations WHERE locale = 'uk';
SELECT pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), :'l0')) AS wal_total_b_to_a_products;
ROLLBACK;
