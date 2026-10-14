-- 01_index_a.sql — індекси й обмеження core і моделі A (дзеркало 0001_init.sql + переклади)
\timing on
-- core: як у 0001_init.sql
ALTER TABLE core.product_property_values ADD CONSTRAINT ppv_owner_property_option_key UNIQUE NULLS NOT DISTINCT (product_id, property_id, option_id);
CREATE INDEX ON core.product_property_values (option_id);
CREATE INDEX ON core.product_property_values (property_id);
ALTER TABLE core.modification_property_values ADD CONSTRAINT mpv_owner_property_option_key UNIQUE NULLS NOT DISTINCT (modification_id, property_id, option_id);
CREATE INDEX ON core.modification_property_values (option_id);
CREATE INDEX ON core.modification_property_values (property_id);
CREATE UNIQUE INDEX product_prices_unique ON core.product_prices (price_type_id, product_id, COALESCE(modification_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX ON core.product_prices (product_id);
CREATE INDEX ON core.product_prices (modification_id);
ALTER TABLE core.section_property_assignments ADD CONSTRAINT spa_section_property_key UNIQUE (section_id, property_id);
CREATE INDEX ON core.section_property_assignments (property_id);

-- A: базові таблиці
ALTER TABLE a.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
CREATE INDEX ON a.products (section_id);
ALTER TABLE a.product_modifications ADD CONSTRAINT pm_product_slug_key UNIQUE (product_id, slug);
ALTER TABLE a.product_modifications ADD FOREIGN KEY (product_id) REFERENCES a.products(id) ON DELETE CASCADE;
ALTER TABLE a.sections ADD CONSTRAINT sections_slug_key UNIQUE (slug);
CREATE INDEX ON a.sections (parent_id);
ALTER TABLE a.section_properties ADD CONSTRAINT sp_slug_key UNIQUE (slug);
ALTER TABLE a.property_options ADD CONSTRAINT po_property_slug_key UNIQUE (property_id, slug);
-- A: переклади — PK (entity_id, locale) уже є; UNIQUE(locale, slug) + FK з каскадом
ALTER TABLE a.product_translations ADD CONSTRAINT pt_locale_slug_key UNIQUE (locale, slug);
ALTER TABLE a.product_translations ADD FOREIGN KEY (product_id) REFERENCES a.products(id) ON DELETE CASCADE;
ALTER TABLE a.product_modification_translations ADD FOREIGN KEY (modification_id) REFERENCES a.product_modifications(id) ON DELETE CASCADE;
ALTER TABLE a.section_translations ADD CONSTRAINT st_locale_slug_key UNIQUE (locale, slug);
ALTER TABLE a.section_translations ADD FOREIGN KEY (section_id) REFERENCES a.sections(id) ON DELETE CASCADE;
ALTER TABLE a.section_property_translations ADD CONSTRAINT spt_locale_slug_key UNIQUE (locale, slug);
ALTER TABLE a.section_property_translations ADD FOREIGN KEY (property_id) REFERENCES a.section_properties(id) ON DELETE CASCADE;
ALTER TABLE a.property_option_translations ADD CONSTRAINT pot_prop_locale_slug_key UNIQUE (property_id, locale, slug);
ALTER TABLE a.property_option_translations ADD FOREIGN KEY (option_id) REFERENCES a.property_options(id) ON DELETE CASCADE;
VACUUM ANALYZE;
