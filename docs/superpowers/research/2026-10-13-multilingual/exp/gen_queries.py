#!/usr/bin/env python3
"""gen_queries.py — генерує 12_queries.sql: шаблони запитів для кожної моделі.

Шаблон — рядок для format() усередині bench.run(): %1$L, %2$L … підставляються
літералами (як після bind у драйвері з подальшим custom plan). Плейсхолдери:
  PDP:      1=locale 2=slug
  LIST/FAC: 1=locale 2=subtree uuid[] 3..5=опції фільтрів f1..f3 (NULL = немає)
            6..8=властивості фільтрів 9=фасетні властивості
  SEARCH:   1=locale 2=tsquery 3=сирий рядок (триграми)
  HYDRATE:  1=locale 2=ids uuid[]
  SITEMAP:  1=locale
"""
RETAIL = "'00000000-0000-4000-8000-000000000001'"
Q = []

def add(model, test, sql):
    Q.append((model, test, sql.strip()))

# ---------- допоміжні фрагменти: текст із fallback у кожній моделі ----------
# A: базова таблиця = uk; t = переклад локалі (LEFT JOIN), COALESCE(t.f, base.f)
# B: td = рядок uk (JOIN), t = переклад локалі (LEFT JOIN), COALESCE(t.f, td.f)
# D: COALESCE(col->>locale, col->>'uk')
def tr(model, alias_base, alias_t, alias_td, field):
    if model == 'a':
        return f"coalesce({alias_t}.{field}, {alias_base}.{field})"
    if model == 'b':
        return f"coalesce({alias_t}.{field}, {alias_td}.{field})"
    return f"coalesce({alias_base}.{field}->>%1$L, {alias_base}.{field}->>'uk')"

def join_tr(model, table, key, alias_base, alias_t, alias_td, locale='%1$L', left_base=False):
    """JOIN-и перекладу для сутності: A — 1 LEFT JOIN, B — JOIN uk + LEFT JOIN локалі, D — нічого."""
    if model == 'a':
        return f"LEFT JOIN a.{table} {alias_t} ON {alias_t}.{key} = {alias_base}.id AND {alias_t}.locale = {locale}"
    if model == 'b':
        j = 'LEFT JOIN' if left_base else 'JOIN'
        return (f"{j} b.{table} {alias_td} ON {alias_td}.{key} = {alias_base}.id AND {alias_td}.locale = 'uk' "
                f"LEFT JOIN b.{table} {alias_t} ON {alias_t}.{key} = {alias_base}.id AND {alias_t}.locale = {locale}")
    return ""

def filters(m):
    out = []
    for k in (3, 4, 5):
        out.append(f"""AND (%{k}$L::uuid[] IS NULL
      OR EXISTS (SELECT 1 FROM core.product_property_values v WHERE v.product_id = p.id AND v.option_id = ANY(%{k}$L::uuid[]))
      OR EXISTS (SELECT 1 FROM {m}.product_modifications m JOIN core.modification_property_values v ON v.modification_id = m.id
                 WHERE m.product_id = p.id AND v.option_id = ANY(%{k}$L::uuid[])))""")
    return "\n    ".join(out)

# ======================= PDP =======================
def slug_resolve(model):
    if model == 'a':
        return """(SELECT id FROM (
      SELECT product_id AS id FROM a.product_translations WHERE locale = %1$L AND slug = %2$L
      UNION ALL
      SELECT p2.id FROM a.products p2 WHERE p2.slug = %2$L
        AND NOT EXISTS (SELECT 1 FROM a.product_translations t2 WHERE t2.product_id = p2.id AND t2.locale = %1$L AND t2.slug IS NOT NULL)
    ) s LIMIT 1)"""
    if model == 'b':
        return """(SELECT id FROM (
      SELECT product_id AS id FROM b.product_translations WHERE locale = %1$L AND slug = %2$L
      UNION ALL
      SELECT t1.product_id FROM b.product_translations t1 WHERE t1.locale = 'uk' AND t1.slug = %2$L
        AND NOT EXISTS (SELECT 1 FROM b.product_translations t2 WHERE t2.product_id = t1.product_id AND t2.locale = %1$L AND t2.slug IS NOT NULL)
    ) s LIMIT 1)"""
    if model == 'd':  # expression-індекс на кожну мову: локаль мусить бути ЛІТЕРАЛОМ у тексті SQL
        return """(SELECT id FROM (
      SELECT p2.id FROM d.products p2 WHERE (p2.slug->>%1$L) = %2$L AND p2.slug ? %1$L
      UNION ALL
      SELECT p2.id FROM d.products p2 WHERE (p2.slug->>'uk') = %2$L AND NOT p2.slug ? %1$L
    ) s LIMIT 1)"""
    if model == 'dgin':  # один GIN jsonb_path_ops: локаль може бути параметром
        return """(SELECT id FROM (
      SELECT p2.id FROM d.products p2 WHERE p2.slug @> jsonb_build_object(%1$L, %2$L)
      UNION ALL
      SELECT p2.id FROM d.products p2 WHERE p2.slug @> jsonb_build_object('uk', %2$L) AND NOT p2.slug ? %1$L
    ) s LIMIT 1)"""
    if model == 'a_r2slug':  # A + реєстр slug із застосованим fallback (r2.cat_text)
        return "(SELECT product_id FROM r2.cat_text WHERE locale = %1$L AND slug = %2$L)"

def pdp(model, resolver):
    m = 'd' if model == 'd' else model
    T = lambda ab, at, atd, f: tr(m, ab, at, atd, f)
    return f"""
SELECT json_build_object(
  'id', p.id, 'name', {T('p','t','td','name')}, 'slug', {T('p','t','td','slug')},
  'short_description', {T('p','t','td','short_description')}, 'description', {T('p','t','td','description')},
  'meta_title', {T('p','t','td','meta_title')}, 'meta_description', {T('p','t','td','meta_description')},
  'images', p.images, 'sku', p.sku, 'stock_status', p.stock_status,
  'section', (SELECT json_build_object('id', s.id, 'name', {T('s','st','std','name')}, 'slug', {T('s','st','std','slug')})
              FROM {m}.sections s {join_tr(m,'section_translations','section_id','s','st','std')} WHERE s.id = p.section_id),
  'modifications', (
    SELECT json_agg(json_build_object('id', mo.id, 'slug', mo.slug, 'name', {T('mo','mt','mtd','name')}, 'price', pp.price,
             'old_price', pp.old_price, 'stock_status', mo.stock_status,
             'props', (SELECT json_agg(json_build_object('property', {T('sp','spt','sptd','name')}, 'value', {T('o','ot','otd','name')}) ORDER BY sp.sort_order)
                       FROM core.modification_property_values v JOIN {m}.section_properties sp ON sp.id = v.property_id
                       {join_tr(m,'section_property_translations','property_id','sp','spt','sptd')}
                       LEFT JOIN {m}.property_options o ON o.id = v.option_id
                       {join_tr(m,'property_option_translations','option_id','o','ot','otd', left_base=True)}
                       WHERE v.modification_id = mo.id)) ORDER BY mo.sort_order)
    FROM {m}.product_modifications mo
    {join_tr(m,'product_modification_translations','modification_id','mo','mt','mtd')}
    LEFT JOIN core.product_prices pp ON pp.modification_id = mo.id AND pp.price_type_id = {RETAIL}
    WHERE mo.product_id = p.id),
  'properties', (
    SELECT json_agg(json_build_object('property', {T('sp','spt','sptd','name')}, 'property_slug', {T('sp','spt','sptd','slug')},
             'value', coalesce({T('o','ot','otd','name')}, v.value, v.numeric_value::text), 'option_slug', {T('o','ot','otd','slug')}) ORDER BY sp.sort_order)
    FROM core.product_property_values v JOIN {m}.section_properties sp ON sp.id = v.property_id
    {join_tr(m,'section_property_translations','property_id','sp','spt','sptd')}
    LEFT JOIN {m}.property_options o ON o.id = v.option_id
    {join_tr(m,'property_option_translations','option_id','o','ot','otd', left_base=True)}
    WHERE v.product_id = p.id))
FROM {m}.products p
{join_tr(m,'product_translations','product_id','p','t','td')}
WHERE p.is_active AND p.id = {slug_resolve(resolver)}"""

add('A', 'pdp', pdp('a', 'a'))
add('B', 'pdp', pdp('b', 'b'))
add('D', 'pdp', pdp('d', 'd'))
add('D-gin', 'pdp', pdp('d', 'dgin'))
add('A+slugreg', 'pdp', pdp('a', 'a_r2slug'))

# ======================= ЛІСТИНГ =======================
for m in ('a', 'b', 'd'):
    M = m.upper()
    name = tr(m, 'p', 't', 'td', 'name'); slug = tr(m, 'p', 't', 'td', 'slug')
    add(M, 'list_price', f"""
SELECT x.id, {name} AS name, {slug} AS slug, p.images->>0 AS image, x.price_min
FROM (
  SELECT p.id, pr.price_min FROM {m}.products p
  CROSS JOIN LATERAL (SELECT min(pp.price) AS price_min FROM core.product_prices pp WHERE pp.product_id = p.id AND pp.price_type_id = {RETAIL}) pr
  WHERE p.section_id = ANY(%2$L::uuid[]) AND p.is_active
    {filters(m)}
  ORDER BY pr.price_min, p.id LIMIT 24) x
JOIN {m}.products p ON p.id = x.id
{join_tr(m,'product_translations','product_id','p','t','td')}
ORDER BY x.price_min, x.id""")
    add(M, 'list_name', f"""
SELECT p.id, {name} AS name, {slug} AS slug, p.images->>0 AS image,
       (SELECT min(pp.price) FROM core.product_prices pp WHERE pp.product_id = p.id AND pp.price_type_id = {RETAIL}) AS price_min
FROM {m}.products p
{join_tr(m,'product_translations','product_id','p','t','td')}
WHERE p.section_id = ANY(%2$L::uuid[]) AND p.is_active
    {filters(m)}
ORDER BY {name}, p.id LIMIT 24""")
    add(M, 'facets', f"""
WITH base AS (SELECT p.id FROM {m}.products p WHERE p.section_id = ANY(%2$L::uuid[]) AND p.is_active),
po AS (
  SELECT v.product_id, v.property_id, v.option_id FROM core.product_property_values v JOIN base ON base.id = v.product_id WHERE v.option_id IS NOT NULL
  UNION
  SELECT mo.product_id, v.property_id, v.option_id FROM base JOIN {m}.product_modifications mo ON mo.product_id = base.id
  JOIN core.modification_property_values v ON v.modification_id = mo.id),
fm AS (SELECT product_id,
         (%3$L::uuid[] IS NULL OR bool_or(option_id = ANY(%3$L::uuid[]))) AS m1,
         (%4$L::uuid[] IS NULL OR bool_or(option_id = ANY(%4$L::uuid[]))) AS m2,
         (%5$L::uuid[] IS NULL OR bool_or(option_id = ANY(%5$L::uuid[]))) AS m3
       FROM po GROUP BY product_id),
cnt AS (SELECT po.property_id, po.option_id, count(*) AS n FROM po JOIN fm USING (product_id)
        WHERE po.property_id = ANY(%9$L::uuid[])
          AND (fm.m1 OR po.property_id = %6$L::uuid) AND (fm.m2 OR po.property_id = %7$L::uuid) AND (fm.m3 OR po.property_id = %8$L::uuid)
        GROUP BY 1, 2)
SELECT cnt.property_id, {tr(m,'sp','spt','sptd','name')} AS property, cnt.option_id, {tr(m,'o','ot','otd','name')} AS option,
       {tr(m,'o','ot','otd','slug')} AS option_slug, cnt.n, (SELECT count(*) FROM fm WHERE m1 AND m2 AND m3) AS total
FROM cnt JOIN {m}.section_properties sp ON sp.id = cnt.property_id
{join_tr(m,'section_property_translations','property_id','sp','spt','sptd')}
JOIN {m}.property_options o ON o.id = cnt.option_id
{join_tr(m,'property_option_translations','option_id','o','ot','otd')}
ORDER BY sp.sort_order, o.sort_order""")

RF = """AND (%3$L::uuid[] IS NULL OR {a}.option_ids && %3$L::uuid[])
    AND (%4$L::uuid[] IS NULL OR {a}.option_ids && %4$L::uuid[])
    AND (%5$L::uuid[] IS NULL OR {a}.option_ids && %5$L::uuid[])"""
add('R', 'list_price', f"""
SELECT ce.product_id, ce.name, ce.slug, ce.image, ce.price_min FROM r.catalog_entries ce
WHERE ce.locale = %1$L AND ce.is_active AND ce.section_id = ANY(%2$L::uuid[])
    {RF.format(a='ce')}
ORDER BY ce.price_min, ce.product_id LIMIT 24""")
add('R', 'list_name', f"""
SELECT ce.product_id, ce.name, ce.slug, ce.image, ce.price_min FROM r.catalog_entries ce
WHERE ce.locale = %1$L AND ce.is_active AND ce.section_id = ANY(%2$L::uuid[])
    {RF.format(a='ce')}
ORDER BY ce.name, ce.product_id LIMIT 24""")
add('R2', 'list_price', f"""
SELECT x.product_id, t.name, t.slug, x.image, x.price_min FROM (
  SELECT f.product_id, f.image, f.price_min FROM r2.cat_facts f
  WHERE f.is_active AND f.section_id = ANY(%2$L::uuid[])
    {RF.format(a='f')}
  ORDER BY f.price_min, f.product_id LIMIT 24) x
JOIN r2.cat_text t ON t.product_id = x.product_id AND t.locale = %1$L
ORDER BY x.price_min, x.product_id""")
add('R2', 'list_name', f"""
SELECT f.product_id, t.name, t.slug, f.image, f.price_min FROM r2.cat_facts f
JOIN r2.cat_text t ON t.product_id = f.product_id AND t.locale = %1$L
WHERE f.is_active AND f.section_id = ANY(%2$L::uuid[])
    {RF.format(a='f')}
ORDER BY t.name, f.product_id LIMIT 24""")
for M, base in (('R', "SELECT ce.product_id, ce.option_ids FROM r.catalog_entries ce WHERE ce.locale = %1$L AND ce.is_active AND ce.section_id = ANY(%2$L::uuid[])"),
                ('R2', "SELECT f.product_id, f.option_ids FROM r2.cat_facts f WHERE f.is_active AND f.section_id = ANY(%2$L::uuid[])")):
    add(M, 'facets', f"""
WITH base AS ({base}),
fm AS (SELECT product_id, option_ids,
         (%3$L::uuid[] IS NULL OR option_ids && %3$L::uuid[]) AS m1,
         (%4$L::uuid[] IS NULL OR option_ids && %4$L::uuid[]) AS m2,
         (%5$L::uuid[] IS NULL OR option_ids && %5$L::uuid[]) AS m3 FROM base),
-- спершу агрегуємо за (опція, маски фільтрів), і лише потім — мітки/властивості:
-- так пошук у r.facet_labels робиться на кожну РІЗНУ опцію, а не на кожен елемент масиву
c AS (SELECT x.option_id, fm.m1, fm.m2, fm.m3, count(*) AS n
      FROM fm CROSS JOIN LATERAL unnest(fm.option_ids) AS x(option_id) GROUP BY 1, 2, 3, 4),
cnt AS (SELECT fl.property_id, c.option_id, sum(c.n) AS n
        FROM c JOIN r.facet_labels fl ON fl.locale = %1$L AND fl.option_id = c.option_id
        WHERE fl.property_id = ANY(%9$L::uuid[])
          AND (c.m1 OR fl.property_id = %6$L::uuid) AND (c.m2 OR fl.property_id = %7$L::uuid) AND (c.m3 OR fl.property_id = %8$L::uuid)
        GROUP BY 1, 2)
SELECT cnt.property_id, fl.property_name, cnt.option_id, fl.option_name, fl.option_slug, cnt.n,
       (SELECT count(*) FROM fm WHERE m1 AND m2 AND m3) AS total
FROM cnt JOIN r.facet_labels fl ON fl.locale = %1$L AND fl.option_id = cnt.option_id
ORDER BY fl.property_sort, fl.option_sort""")

# ======================= ПОШУК =======================
# Спека: FTS ∪ trigram, злиття RRF за позиціями, стеля кандидатів перед ранжуванням,
# фасети тим самим SQL. Для A/B/D індекс — core.search_documents (не залежить від моделі),
# модельна частина — фільтр активності, фасети й гідрація карток.
def search_sql(src, key, active_join, po_sql, facet_sql, top_sql):
    return f"""
WITH q AS (SELECT to_tsquery('simple', %2$L) AS tq),
cand AS (SELECT s.{key} AS id, s.tsv FROM {src} s, q WHERE s.locale = %1$L {active_join[0]} AND s.tsv @@ q.tq LIMIT 1000),
fts AS (SELECT cand.id, row_number() OVER (ORDER BY ts_rank_cd(cand.tsv, q.tq) DESC, cand.id) AS rnk FROM cand, q),
trg AS (SELECT z.id, row_number() OVER (ORDER BY z.d, z.id) AS rnk FROM (
          SELECT s.{key} AS id, %3$L <<-> s.title_norm AS d FROM {src} s
          WHERE s.locale = %1$L {active_join[0]} AND %3$L <%% s.title_norm ORDER BY d LIMIT 100) z),
fused AS (SELECT u.id, sum(1.0 / (60 + u.rnk)) AS score FROM (SELECT * FROM fts UNION ALL SELECT * FROM trg) u GROUP BY u.id),
hits AS ({active_join[1]}),
po AS ({po_sql}),
facets AS ({facet_sql})
{top_sql}"""

for m in ('a', 'b', 'd'):
    M = m.upper()
    add(M, 'search', search_sql(
        'core.search_documents', 'entity_id', ("AND s.entity_type = 'product'",
         f"SELECT f.id AS product_id, f.score FROM fused f JOIN {m}.products p ON p.id = f.id AND p.is_active"),
        f"""SELECT v.product_id, v.property_id, v.option_id FROM core.product_property_values v JOIN hits ON hits.product_id = v.product_id WHERE v.option_id IS NOT NULL
        UNION SELECT mo.product_id, v.property_id, v.option_id FROM hits JOIN {m}.product_modifications mo ON mo.product_id = hits.product_id
        JOIN core.modification_property_values v ON v.modification_id = mo.id""",
        f"SELECT po.property_id, po.option_id, count(*) AS n FROM po JOIN {m}.section_properties sp ON sp.id = po.property_id AND sp.is_filterable GROUP BY 1, 2",
        f"""SELECT 'hit' AS kind, h.product_id AS id, NULL::text AS label, h.score AS v FROM (SELECT * FROM hits ORDER BY score DESC, product_id LIMIT 24) h
UNION ALL SELECT 'facet', f.option_id, {tr(m,'o','ot','otd','name')}, f.n FROM facets f JOIN {m}.property_options o ON o.id = f.option_id
  {join_tr(m,'property_option_translations','option_id','o','ot','otd')}
UNION ALL SELECT 'total', NULL, NULL, count(*) FROM hits"""))
    name = tr(m, 'p', 't', 'td', 'name'); slug = tr(m, 'p', 't', 'td', 'slug')
    add(M, 'hydrate', f"""
SELECT p.id, {name} AS name, {slug} AS slug, p.images->>0 AS image,
       (SELECT min(pp.price) FROM core.product_prices pp WHERE pp.product_id = p.id AND pp.price_type_id = {RETAIL}) AS price_min
FROM {m}.products p {join_tr(m,'product_translations','product_id','p','t','td')}
WHERE p.id = ANY(%2$L::uuid[])""")

add('R', 'search', search_sql(
    'r.catalog_entries', 'product_id', ("AND s.is_active",
     "SELECT f.id AS product_id, f.score, ce.option_ids, ce.name, ce.slug, ce.image, ce.price_min FROM fused f JOIN r.catalog_entries ce ON ce.product_id = f.id AND ce.locale = %1$L"),
    "SELECT hits.product_id, x.option_id FROM hits CROSS JOIN LATERAL unnest(hits.option_ids) AS x(option_id)",
    "SELECT fl.property_id, c.option_id, fl.option_name, c.n FROM (SELECT po.option_id, count(*) AS n FROM po GROUP BY 1) c JOIN r.facet_labels fl ON fl.locale = %1$L AND fl.option_id = c.option_id AND fl.is_filterable",
    """SELECT 'hit' AS kind, h.product_id AS id, h.name AS label, h.score AS v, h.slug, h.image, h.price_min FROM (SELECT * FROM hits ORDER BY score DESC, product_id LIMIT 24) h
UNION ALL SELECT 'facet', f.option_id, f.option_name, f.n, NULL, NULL, NULL FROM facets f
UNION ALL SELECT 'total', NULL, NULL, count(*), NULL, NULL, NULL FROM hits"""))
add('R2', 'search', search_sql(
    'core.search_documents', 'entity_id', ("AND s.entity_type = 'product'",
     "SELECT f.id AS product_id, f.score, cf.option_ids, cf.image, cf.price_min FROM fused f JOIN r2.cat_facts cf ON cf.product_id = f.id AND cf.is_active"),
    "SELECT hits.product_id, x.option_id FROM hits CROSS JOIN LATERAL unnest(hits.option_ids) AS x(option_id)",
    "SELECT fl.property_id, c.option_id, fl.option_name, c.n FROM (SELECT po.option_id, count(*) AS n FROM po GROUP BY 1) c JOIN r.facet_labels fl ON fl.locale = %1$L AND fl.option_id = c.option_id AND fl.is_filterable",
    """SELECT 'hit' AS kind, h.product_id AS id, t.name AS label, h.score AS v, t.slug, h.image, h.price_min
   FROM (SELECT * FROM hits ORDER BY score DESC, product_id LIMIT 24) h JOIN r2.cat_text t ON t.product_id = h.product_id AND t.locale = %1$L
UNION ALL SELECT 'facet', f.option_id, f.option_name, f.n, NULL, NULL, NULL FROM facets f
UNION ALL SELECT 'total', NULL, NULL, count(*), NULL, NULL, NULL FROM hits"""))

# ======================= SITEMAP =======================
# alternates = мови, де товар реально перекладений (+uk); slug поточної мови — з fallback
add('A', 'sitemap', """
SELECT p.id, coalesce(tr.slugs->>%1$L, p.slug) AS slug, jsonb_build_object('uk', p.slug) || coalesce(tr.slugs, '{}') AS alternates, p.updated_at
FROM a.products p
LEFT JOIN (SELECT product_id, jsonb_object_agg(locale, slug) AS slugs FROM a.product_translations WHERE slug IS NOT NULL GROUP BY product_id) tr ON tr.product_id = p.id
WHERE p.is_active""")
add('B', 'sitemap', """
SELECT p.id, coalesce(tr.slugs->>%1$L, tr.slugs->>'uk') AS slug, tr.slugs AS alternates, p.updated_at
FROM b.products p
JOIN (SELECT product_id, jsonb_object_agg(locale, slug) AS slugs FROM b.product_translations WHERE slug IS NOT NULL GROUP BY product_id) tr ON tr.product_id = p.id
WHERE p.is_active""")
add('D', 'sitemap', """
SELECT p.id, coalesce(p.slug->>%1$L, p.slug->>'uk') AS slug, p.slug AS alternates, p.updated_at FROM d.products p WHERE p.is_active""")
add('R', 'sitemap', """
SELECT ce.product_id, max(ce.slug) FILTER (WHERE ce.locale = %1$L) AS slug, jsonb_object_agg(ce.locale, ce.slug) AS alternates
FROM r.catalog_entries ce WHERE ce.is_active GROUP BY ce.product_id""")
add('R2', 'sitemap', """
SELECT t.product_id, max(t.slug) FILTER (WHERE t.locale = %1$L) AS slug, jsonb_object_agg(t.locale, t.slug) AS alternates
FROM r2.cat_text t JOIN r2.cat_facts f ON f.product_id = t.product_id AND f.is_active GROUP BY t.product_id""")

with open('12_queries.sql', 'w') as fh:
    fh.write("-- 12_queries.sql — ЗГЕНЕРОВАНО gen_queries.py; шаблони запитів по моделях\n")
    fh.write("DROP TABLE IF EXISTS bench.q;\nCREATE TABLE bench.q (model text, test text, sql text, PRIMARY KEY (model, test));\n")
    for model, test, sql in Q:
        fh.write(f"INSERT INTO bench.q VALUES ('{model}', '{test}', $q${sql}$q$);\n")
print(len(Q), 'templates')
