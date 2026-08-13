
-- Enum for discount types
CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed_amount', 'fixed_price');

-- Enum for group operators
CREATE TYPE public.discount_group_operator AS ENUM ('and', 'or', 'not', 'min', 'max');

-- Enum for discount target types
CREATE TYPE public.discount_target_type AS ENUM ('product', 'modification', 'section', 'all');

-- 1. discount_groups
CREATE TABLE public.discount_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  operator discount_group_operator NOT NULL DEFAULT 'and',
  parent_group_id uuid REFERENCES public.discount_groups(id) ON DELETE CASCADE,
  price_type_id uuid NOT NULL REFERENCES public.price_types(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active discount groups"
  ON public.discount_groups FOR SELECT USING (true);

CREATE POLICY "Admins can manage discount groups"
  ON public.discount_groups FOR ALL USING (public.is_admin());

CREATE TRIGGER update_discount_groups_updated_at
  BEFORE UPDATE ON public.discount_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. discounts
CREATE TABLE public.discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  group_id uuid NOT NULL REFERENCES public.discount_groups(id) ON DELETE CASCADE,
  discount_type discount_type NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active discounts"
  ON public.discounts FOR SELECT USING (true);

CREATE POLICY "Admins can manage discounts"
  ON public.discounts FOR ALL USING (public.is_admin());

CREATE TRIGGER update_discounts_updated_at
  BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. discount_targets
CREATE TABLE public.discount_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  target_type discount_target_type NOT NULL DEFAULT 'all',
  target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view discount targets"
  ON public.discount_targets FOR SELECT USING (true);

CREATE POLICY "Admins can manage discount targets"
  ON public.discount_targets FOR ALL USING (public.is_admin());

-- 4. discount_conditions
CREATE TABLE public.discount_conditions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_id uuid NOT NULL REFERENCES public.discounts(id) ON DELETE CASCADE,
  condition_type varchar NOT NULL,
  operator varchar NOT NULL DEFAULT '=',
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view discount conditions"
  ON public.discount_conditions FOR SELECT USING (true);

CREATE POLICY "Admins can manage discount conditions"
  ON public.discount_conditions FOR ALL USING (public.is_admin());

-- 5. Add discount columns to order_items
ALTER TABLE public.order_items
  ADD COLUMN base_price numeric,
  ADD COLUMN discount_data jsonb;

-- Indexes
CREATE INDEX idx_discount_groups_parent ON public.discount_groups(parent_group_id);
CREATE INDEX idx_discount_groups_price_type ON public.discount_groups(price_type_id);
CREATE INDEX idx_discounts_group ON public.discounts(group_id);
CREATE INDEX idx_discount_targets_discount ON public.discount_targets(discount_id);
CREATE INDEX idx_discount_conditions_discount ON public.discount_conditions(discount_id);
