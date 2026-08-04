-- Step 1: Add new columns to shipping_zones
ALTER TABLE shipping_zones
ADD COLUMN cities text[] DEFAULT '{}',
ADD COLUMN regions text[] DEFAULT '{}';

-- Step 2: Drop foreign key constraints first
ALTER TABLE shipping_zone_locations DROP CONSTRAINT IF EXISTS shipping_zone_locations_location_id_fkey;
ALTER TABLE shipping_zone_locations DROP CONSTRAINT IF EXISTS shipping_zone_locations_zone_id_fkey;

-- Step 3: Drop the junction table
DROP TABLE IF EXISTS shipping_zone_locations;

-- Step 4: Drop the locations table
DROP TABLE IF EXISTS locations;

-- Step 5: Drop the enum types
DROP TYPE IF EXISTS zone_location_type;
DROP TYPE IF EXISTS location_type;