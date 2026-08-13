-- =====================================================
-- SHIPPING MANAGEMENT SYSTEM - Core Database Structure
-- =====================================================

-- Enum types
CREATE TYPE shipping_method_type AS ENUM ('system', 'manual', 'plugin');
CREATE TYPE shipping_calculation_type AS ENUM ('flat', 'weight', 'order_total', 'free_from', 'plugin');
CREATE TYPE location_type AS ENUM ('country', 'region', 'city', 'district', 'street');
CREATE TYPE zone_location_type AS ENUM ('all', 'country', 'region', 'city', 'postcode');

-- =====================================================
-- 1. SHIPPING METHODS (Служби доставки)
-- =====================================================
CREATE TABLE public.shipping_methods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    type shipping_method_type NOT NULL DEFAULT 'manual',
    plugin_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for shipping_methods
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping methods are viewable by everyone" 
ON public.shipping_methods FOR SELECT 
USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage shipping methods" 
ON public.shipping_methods FOR ALL 
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_shipping_methods_updated_at
BEFORE UPDATE ON public.shipping_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. LOCATIONS (Ієрархічний довідник локацій)
-- =====================================================
CREATE TABLE public.locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type location_type NOT NULL DEFAULT 'city',
    code VARCHAR(50),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for hierarchy queries
CREATE INDEX idx_locations_parent_id ON public.locations(parent_id);
CREATE INDEX idx_locations_type ON public.locations(type);
CREATE INDEX idx_locations_code ON public.locations(code);

-- RLS for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations are viewable by everyone" 
ON public.locations FOR SELECT 
USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage locations" 
ON public.locations FOR ALL 
USING (is_admin());

-- =====================================================
-- 3. SHIPPING ZONES (Зони доставки)
-- =====================================================
CREATE TABLE public.shipping_zones (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for shipping_zones
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping zones are viewable by everyone" 
ON public.shipping_zones FOR SELECT 
USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage shipping zones" 
ON public.shipping_zones FOR ALL 
USING (is_admin());

-- =====================================================
-- 4. SHIPPING ZONE LOCATIONS (Прив'язка локацій до зон)
-- =====================================================
CREATE TABLE public.shipping_zone_locations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    zone_id UUID NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    location_type zone_location_type NOT NULL DEFAULT 'city',
    location_code VARCHAR(50),
    postcode_from VARCHAR(20),
    postcode_to VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for zone lookups
CREATE INDEX idx_shipping_zone_locations_zone_id ON public.shipping_zone_locations(zone_id);
CREATE INDEX idx_shipping_zone_locations_location_id ON public.shipping_zone_locations(location_id);

-- RLS for shipping_zone_locations
ALTER TABLE public.shipping_zone_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zone locations are viewable by everyone" 
ON public.shipping_zone_locations FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage zone locations" 
ON public.shipping_zone_locations FOR ALL 
USING (is_admin());

-- =====================================================
-- 5. SHIPPING RATES (Тарифи доставки)
-- =====================================================
CREATE TABLE public.shipping_rates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    method_id UUID NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
    zone_id UUID NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    calculation_type shipping_calculation_type NOT NULL DEFAULT 'flat',
    base_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
    per_kg_cost NUMERIC(10,2),
    min_weight NUMERIC(10,2),
    free_from_amount NUMERIC(10,2),
    min_order_amount NUMERIC(10,2),
    max_order_amount NUMERIC(10,2),
    estimated_days VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for rate lookups
CREATE INDEX idx_shipping_rates_method_id ON public.shipping_rates(method_id);
CREATE INDEX idx_shipping_rates_zone_id ON public.shipping_rates(zone_id);

-- RLS for shipping_rates
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping rates are viewable by everyone" 
ON public.shipping_rates FOR SELECT 
USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage shipping rates" 
ON public.shipping_rates FOR ALL 
USING (is_admin());

-- =====================================================
-- 6. PICKUP POINTS (Точки самовивозу)
-- =====================================================
CREATE TABLE public.pickup_points (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    method_id UUID NOT NULL REFERENCES public.shipping_methods(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    zone_id UUID REFERENCES public.shipping_zones(id) ON DELETE SET NULL,
    working_hours JSONB DEFAULT '{}'::jsonb,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    coordinates JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for pickup point lookups
CREATE INDEX idx_pickup_points_method_id ON public.pickup_points(method_id);
CREATE INDEX idx_pickup_points_zone_id ON public.pickup_points(zone_id);
CREATE INDEX idx_pickup_points_city ON public.pickup_points(city);

-- RLS for pickup_points
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pickup points are viewable by everyone" 
ON public.pickup_points FOR SELECT 
USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage pickup points" 
ON public.pickup_points FOR ALL 
USING (is_admin());

-- =====================================================
-- 7. UPDATE ORDERS TABLE (Додаткові поля для доставки)
-- =====================================================
ALTER TABLE public.orders
ADD COLUMN shipping_method_id UUID REFERENCES public.shipping_methods(id) ON DELETE SET NULL,
ADD COLUMN shipping_zone_id UUID REFERENCES public.shipping_zones(id) ON DELETE SET NULL,
ADD COLUMN shipping_rate_id UUID REFERENCES public.shipping_rates(id) ON DELETE SET NULL,
ADD COLUMN shipping_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN pickup_point_id UUID REFERENCES public.pickup_points(id) ON DELETE SET NULL,
ADD COLUMN shipping_data JSONB DEFAULT '{}'::jsonb;

-- Index for order shipping lookups
CREATE INDEX idx_orders_shipping_method_id ON public.orders(shipping_method_id);
CREATE INDEX idx_orders_pickup_point_id ON public.orders(pickup_point_id);

-- =====================================================
-- 8. SEED DATA - System shipping methods
-- =====================================================
INSERT INTO public.shipping_methods (code, name, description, type, icon, sort_order) VALUES
('pickup', 'Самовивіз', 'Отримайте замовлення в нашому магазині', 'system', 'Building', 1),
('courier', 'Кур''єрська доставка', 'Доставка кур''єром за вашою адресою', 'system', 'Truck', 2);

-- Default shipping zone (for all locations)
INSERT INTO public.shipping_zones (name, description, is_default, sort_order) VALUES
('Вся Україна', 'Зона доставки за замовчуванням для всіх локацій', true, 100);

-- Basic rates for default zone
INSERT INTO public.shipping_rates (method_id, zone_id, name, calculation_type, base_cost, estimated_days)
SELECT 
    sm.id,
    sz.id,
    CASE 
        WHEN sm.code = 'pickup' THEN 'Безкоштовно'
        WHEN sm.code = 'courier' THEN 'Стандартна доставка'
    END,
    'flat',
    CASE 
        WHEN sm.code = 'pickup' THEN 0
        WHEN sm.code = 'courier' THEN 100
    END,
    CASE 
        WHEN sm.code = 'pickup' THEN 'Одразу'
        WHEN sm.code = 'courier' THEN '1-3 дні'
    END
FROM public.shipping_methods sm
CROSS JOIN public.shipping_zones sz
WHERE sm.type = 'system' AND sz.is_default = true;

-- Default location (Ukraine)
INSERT INTO public.locations (name, type, code, sort_order) VALUES
('Україна', 'country', 'UA', 1);