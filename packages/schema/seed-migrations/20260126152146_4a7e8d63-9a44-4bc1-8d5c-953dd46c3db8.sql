-- Add columns for simple products (without modifications)
ALTER TABLE products 
  ADD COLUMN has_modifications boolean DEFAULT true,
  ADD COLUMN price numeric DEFAULT NULL,
  ADD COLUMN old_price numeric DEFAULT NULL,
  ADD COLUMN sku varchar DEFAULT NULL,
  ADD COLUMN stock_quantity integer DEFAULT 0,
  ADD COLUMN is_in_stock boolean DEFAULT true;