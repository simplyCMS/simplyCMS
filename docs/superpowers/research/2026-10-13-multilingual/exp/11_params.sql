-- 11_params.sql — детерміновані параметри для бенчмарків (беруться з даних моделі A)
SELECT setseed(0.42);
DROP TABLE IF EXISTS bench.p_pdp, bench.p_list, bench.p_search;

-- PDP: по 20 активних товарів на локаль; slug — той, що бачить вітрина (з fallback)
CREATE TABLE bench.p_pdp AS
SELECT l.code AS locale, x.id AS product_id, coalesce(t.slug, x.slug) AS slug, t.slug IS NOT NULL AS translated, x.rn
FROM core.locales l
CROSS JOIN LATERAL (SELECT p.id, p.slug, row_number() OVER (ORDER BY md5(p.id::text || l.code)) rn FROM a.products p
                    WHERE p.is_active ORDER BY md5(p.id::text || l.code) LIMIT 20) x
LEFT JOIN a.product_translations t ON t.product_id = x.id AND t.locale = l.code AND t.slug IS NOT NULL;

-- Розділи: найбільший корінь, середній розділ 2-го рівня, середній листок
CREATE TEMP TABLE sec_tree AS
WITH RECURSIVE tree AS (
  SELECT id AS root_id, id, 1 AS lvl FROM a.sections
  UNION ALL SELECT tree.root_id, s.id, tree.lvl + 1 FROM a.sections s JOIN tree ON s.parent_id = tree.id
)
SELECT t.root_id AS section_id, (SELECT CASE WHEN parent_id IS NULL THEN 1 WHEN (SELECT parent_id FROM a.sections p WHERE p.id = s.parent_id) IS NULL THEN 2 ELSE 3 END FROM a.sections s WHERE s.id = t.root_id) AS level,
       array_agg(t.id) AS subtree,
       (SELECT count(*) FROM a.products p WHERE p.section_id = ANY(array_agg(t.id)) AND p.is_active) AS n_products
FROM tree t GROUP BY t.root_id;

CREATE TEMP TABLE chosen AS
(SELECT * FROM sec_tree WHERE level = 1 ORDER BY n_products DESC LIMIT 1)
UNION ALL (SELECT * FROM sec_tree WHERE level = 2 ORDER BY n_products DESC OFFSET 10 LIMIT 1)
UNION ALL (SELECT * FROM sec_tree WHERE level = 3 ORDER BY n_products DESC OFFSET 40 LIMIT 1);

-- Фасетні властивості розділу: 8 фільтровних select-властивостей, найчастіших у піддереві
CREATE TABLE bench.p_list AS
WITH po AS (
  SELECT c.section_id, v.property_id, v.option_id, v.product_id
  FROM chosen c JOIN a.products p ON p.section_id = ANY(c.subtree) AND p.is_active
  JOIN core.product_property_values v ON v.product_id = p.id AND v.option_id IS NOT NULL
  UNION ALL
  SELECT c.section_id, v.property_id, v.option_id, m.product_id
  FROM chosen c JOIN a.products p ON p.section_id = ANY(c.subtree) AND p.is_active
  JOIN a.product_modifications m ON m.product_id = p.id JOIN core.modification_property_values v ON v.modification_id = m.id
), props AS (
  SELECT po.section_id, po.property_id, count(DISTINCT po.product_id) n,
         row_number() OVER (PARTITION BY po.section_id ORDER BY count(DISTINCT po.product_id) DESC, po.property_id) rk
  FROM po JOIN a.section_properties sp ON sp.id = po.property_id AND sp.is_filterable GROUP BY 1, 2
), topopt AS (
  SELECT po.section_id, po.property_id, po.option_id,
         row_number() OVER (PARTITION BY po.section_id, po.property_id ORDER BY count(*) DESC, po.option_id) rk
  FROM po GROUP BY 1, 2, 3
)
SELECT c.level, c.section_id, c.subtree, c.n_products,
       (SELECT array_agg(property_id ORDER BY rk) FROM props WHERE props.section_id = c.section_id AND rk <= 8) AS facet_props,
       f.p1, f.o1, f.p2, f.o2, f.p3, f.o3
FROM chosen c
CROSS JOIN LATERAL (
  SELECT (SELECT property_id FROM props WHERE section_id = c.section_id AND rk = 1) p1,
         (SELECT array_agg(option_id) FROM topopt t JOIN props pp USING (section_id, property_id) WHERE t.section_id = c.section_id AND pp.rk = 1 AND t.rk = 1) o1,
         (SELECT property_id FROM props WHERE section_id = c.section_id AND rk = 2) p2,
         (SELECT array_agg(option_id) FROM topopt t JOIN props pp USING (section_id, property_id) WHERE t.section_id = c.section_id AND pp.rk = 2 AND t.rk <= 2) o2,
         (SELECT property_id FROM props WHERE section_id = c.section_id AND rk = 3) p3,
         (SELECT array_agg(option_id) FROM topopt t JOIN props pp USING (section_id, property_id) WHERE t.section_id = c.section_id AND pp.rk = 3 AND t.rk <= 3) o3
) f;

-- Пошук: «вузький» — 2 слова з назви товару (друге — префікс); «широкий» — часте слово з опису + префікс
CREATE TABLE bench.p_search AS
WITH src AS (
  -- запит пишуть мовою локалі: беремо лише товари, що мають переклад назви в цій локалі
  SELECT l.code AS locale, x.rn, string_to_array(lower(x.name), ' ') AS w
  FROM core.locales l
  CROSS JOIN LATERAL (SELECT p.id, coalesce(t.name, p.name) AS name, row_number() OVER (ORDER BY md5(p.id::text || 's' || l.code)) rn
                      FROM a.products p LEFT JOIN a.product_translations t ON t.product_id = p.id AND t.locale = l.code
                      WHERE p.is_active AND (l.code = 'uk' OR t.name IS NOT NULL)
                      ORDER BY md5(p.id::text || 's' || l.code) LIMIT 20) x
), freq AS (
  -- часті слова тіла тексту саме цієї мови
  SELECT l.code AS locale, z.word, row_number() OVER (PARTITION BY l.code ORDER BY count(*) DESC, z.word) AS rk
  FROM core.locales l CROSS JOIN LATERAL (
    SELECT unnest(string_to_array(lower(coalesce(t.short_description, p.short_description)), ' ')) AS word
    FROM a.products p LEFT JOIN a.product_translations t ON t.product_id = p.id AND t.locale = l.code
    WHERE l.code = 'uk' OR t.short_description IS NOT NULL LIMIT 3000) z
  WHERE length(z.word) > 3 GROUP BY l.code, z.word
)
SELECT locale, rn, 'narrow' AS kind,
       w[1] || ' & ' || left(w[3], greatest(3, length(w[3]) - 2)) || ':*' AS tsq,
       -- «одрук» для триграм: подвоєна літера в першому слові + друге слово
       left(w[1], 2) || substr(w[1], 2, 1) || substr(w[1], 3) || ' ' || w[3] AS raw
FROM src
UNION ALL
SELECT src.locale, src.rn, 'broad', f.word || ' & ' || left(w[2], 3) || ':*', f.word || ' ' || left(w[2], 3)
FROM src JOIN freq f ON f.locale = src.locale AND f.rk = src.rn;

SELECT level, n_products, cardinality(subtree) AS sections, cardinality(facet_props) AS facets, cardinality(o1) o1, cardinality(o2) o2, cardinality(o3) o3 FROM bench.p_list ORDER BY level;
SELECT locale, kind, tsq, raw FROM bench.p_search WHERE rn <= 2 AND locale IN ('uk','en','de') ORDER BY locale, kind, rn;

-- Гідрація 24 карток (після пошуку): 10 наборів по 24 випадкові активні товари
DROP TABLE IF EXISTS bench.p_hydrate;
CREATE TABLE bench.p_hydrate AS
SELECT g AS rn, ARRAY(SELECT p.id FROM a.products p WHERE p.is_active ORDER BY md5(p.id::text || g) LIMIT 24) AS ids
FROM generate_series(1, 10) g;
