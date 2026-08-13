-- Remove unique constraint from product_modifications slug
ALTER TABLE public.product_modifications DROP CONSTRAINT IF EXISTS product_modifications_slug_key;

-- Add a composite unique constraint for product_id + slug instead
ALTER TABLE public.product_modifications ADD CONSTRAINT product_modifications_product_slug_unique UNIQUE (product_id, slug);