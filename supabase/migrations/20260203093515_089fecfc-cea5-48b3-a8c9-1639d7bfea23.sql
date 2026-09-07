
-- Додати унікальний constraint для запобігання дублікатів залишків
-- Комбінація (pickup_point_id, product_id) або (pickup_point_id, modification_id) має бути унікальною

CREATE UNIQUE INDEX IF NOT EXISTS unique_stock_product_per_point 
ON stock_by_pickup_point (pickup_point_id, product_id) 
WHERE product_id IS NOT NULL AND modification_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_stock_modification_per_point 
ON stock_by_pickup_point (pickup_point_id, modification_id) 
WHERE modification_id IS NOT NULL;
