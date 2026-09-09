
-- 1. Create price_types table
CREATE TABLE public.price_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code varchar NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one default price type allowed
CREATE UNIQUE INDEX idx_price_types_single_default ON public.price_types (is_default) WHERE is_default = true;

-- RLS
ALTER TABLE public.price_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price types"
  ON public.price_types FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage price types"
  ON public.price_types FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Insert default price type
INSERT INTO public.price_types (name, code, is_default, sort_order)
VALUES ('Роздрібна', 'retail', true, 0);

-- 2. Create product_prices table
CREATE TABLE public.product_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_type_id uuid NOT NULL REFERENCES public.price_types(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  modification_id uuid REFERENCES public.product_modifications(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  old_price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one price per (type, product, modification) combo
CREATE UNIQUE INDEX idx_product_prices_unique
  ON public.product_prices (price_type_id, product_id, COALESCE(modification_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- updated_at trigger
CREATE TRIGGER update_product_prices_updated_at
  BEFORE UPDATE ON public.product_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product prices"
  ON public.product_prices FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage product prices"
  ON public.product_prices FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Add price_type_id to user_categories
ALTER TABLE public.user_categories
  ADD COLUMN price_type_id uuid REFERENCES public.price_types(id) ON DELETE SET NULL;

-- 4. Migrate existing prices into product_prices for the default price type

-- 4a. Simple products (has_modifications = false or null, price IS NOT NULL)
INSERT INTO public.product_prices (price_type_id, product_id, modification_id, price, old_price)
SELECT
  (SELECT id FROM public.price_types WHERE is_default = true LIMIT 1),
  p.id,
  NULL,
  p.price,
  p.old_price
FROM public.products p
WHERE p.price IS NOT NULL;

-- 4b. Modifications
INSERT INTO public.product_prices (price_type_id, product_id, modification_id, price, old_price)
SELECT
  (SELECT id FROM public.price_types WHERE is_default = true LIMIT 1),
  pm.product_id,
  pm.id,
  pm.price,
  pm.old_price
FROM public.product_modifications pm;

-- 5. Drop legacy columns
ALTER TABLE public.products DROP COLUMN price;
ALTER TABLE public.products DROP COLUMN old_price;
ALTER TABLE public.product_modifications DROP COLUMN price;
ALTER TABLE public.product_modifications DROP COLUMN old_price;
ALTER TABLE public.user_categories DROP COLUMN price_multiplier;
