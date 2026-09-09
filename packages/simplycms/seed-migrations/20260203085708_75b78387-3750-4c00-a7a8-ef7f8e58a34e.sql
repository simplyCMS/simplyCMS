-- ============================================
-- Частина 1: Створення нових таблиць та типів
-- ============================================

-- 1.1. Новий тип enum для статусу наявності
CREATE TYPE stock_status AS ENUM ('in_stock', 'out_of_stock', 'on_order');

-- 1.2. Таблиця системних налаштувань
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(100) UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Увімкнути RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS політики для system_settings
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings FOR ALL 
USING (is_admin());

CREATE POLICY "System settings are viewable by admins" 
ON public.system_settings FOR SELECT 
USING (is_admin());

-- Початкове налаштування
INSERT INTO public.system_settings (key, value, description)
VALUES ('stock_management', '{"decrease_on_order": false}', 
        'Налаштування управління залишками');

-- Тригер для updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3. Додати прапорець системної точки до pickup_points
ALTER TABLE public.pickup_points 
  ADD COLUMN is_system boolean NOT NULL DEFAULT false;

-- 1.4. Зміни в таблиці products
ALTER TABLE public.products 
  ADD COLUMN stock_status stock_status DEFAULT 'in_stock';

-- Міграція існуючих даних
UPDATE public.products SET stock_status = CASE 
  WHEN is_in_stock = true THEN 'in_stock'::stock_status
  ELSE 'out_of_stock'::stock_status
END;

-- Видалити старі поля
ALTER TABLE public.products DROP COLUMN is_in_stock;
ALTER TABLE public.products DROP COLUMN stock_quantity;

-- 1.5. Зміни в таблиці product_modifications
ALTER TABLE public.product_modifications 
  ADD COLUMN stock_status stock_status DEFAULT 'in_stock';

-- Міграція існуючих даних
UPDATE public.product_modifications SET stock_status = CASE 
  WHEN is_in_stock = true THEN 'in_stock'::stock_status
  ELSE 'out_of_stock'::stock_status
END;

-- Видалити старі поля
ALTER TABLE public.product_modifications DROP COLUMN is_in_stock;
ALTER TABLE public.product_modifications DROP COLUMN stock_quantity;

-- 1.6. Таблиця залишків по точках самовивозу
CREATE TABLE public.stock_by_pickup_point (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_point_id uuid NOT NULL REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  modification_id uuid REFERENCES public.product_modifications(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Один запис на комбінацію точка + товар/модифікація
  UNIQUE (pickup_point_id, product_id, modification_id),
  
  -- Або товар, або модифікація (не обидва)
  CONSTRAINT stock_product_or_modification CHECK (
    (product_id IS NOT NULL AND modification_id IS NULL) OR
    (product_id IS NULL AND modification_id IS NOT NULL)
  )
);

-- Увімкнути RLS для stock_by_pickup_point
ALTER TABLE public.stock_by_pickup_point ENABLE ROW LEVEL SECURITY;

-- RLS політики
CREATE POLICY "Admins can manage stock" 
ON public.stock_by_pickup_point FOR ALL 
USING (is_admin());

CREATE POLICY "Stock is viewable by everyone" 
ON public.stock_by_pickup_point FOR SELECT 
USING (true);

-- Тригер для updated_at
CREATE TRIGGER update_stock_by_pickup_point_updated_at
BEFORE UPDATE ON public.stock_by_pickup_point
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Частина 2: RPC функції
-- ============================================

-- 2.1. Функція для отримання інформації про залишки
CREATE OR REPLACE FUNCTION public.get_stock_info(
  p_modification_id uuid DEFAULT NULL, 
  p_product_id uuid DEFAULT NULL
)
RETURNS TABLE (
  total_quantity integer,
  is_available boolean,
  stock_status stock_status,
  by_point jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stock_data AS (
    SELECT 
      sbpp.pickup_point_id,
      pp.name as point_name,
      sbpp.quantity
    FROM stock_by_pickup_point sbpp
    JOIN pickup_points pp ON pp.id = sbpp.pickup_point_id AND pp.is_active = true
    WHERE 
      (p_modification_id IS NOT NULL AND sbpp.modification_id = p_modification_id)
      OR (p_product_id IS NOT NULL AND sbpp.product_id = p_product_id)
  ),
  aggregated AS (
    SELECT 
      COALESCE(SUM(sd.quantity), 0)::integer as total_qty,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'point_id', sd.pickup_point_id,
            'point_name', sd.point_name,
            'quantity', sd.quantity
          )
        ) FILTER (WHERE sd.pickup_point_id IS NOT NULL),
        '[]'::jsonb
      ) as points_data
    FROM stock_data sd
  ),
  status_info AS (
    SELECT 
      CASE 
        WHEN p_modification_id IS NOT NULL THEN 
          (SELECT pm.stock_status FROM product_modifications pm WHERE pm.id = p_modification_id)
        ELSE 
          (SELECT p.stock_status FROM products p WHERE p.id = p_product_id)
      END as current_status
  )
  SELECT 
    a.total_qty,
    (a.total_qty > 0 OR s.current_status = 'on_order') as is_avail,
    s.current_status,
    a.points_data
  FROM aggregated a, status_info s;
END;
$$;

-- 2.2. Функція для отримання загальної кількості точок самовивозу
CREATE OR REPLACE FUNCTION public.get_active_pickup_points_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM pickup_points WHERE is_active = true;
$$;

-- ============================================
-- Частина 3: Тригер для зменшення залишків
-- ============================================

CREATE OR REPLACE FUNCTION public.decrease_stock_on_order()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_decrease boolean;
  point_id uuid;
BEGIN
  -- Перевірити налаштування
  SELECT (value->>'decrease_on_order')::boolean INTO should_decrease
  FROM system_settings WHERE key = 'stock_management';
  
  IF NOT COALESCE(should_decrease, false) THEN
    RETURN NEW;
  END IF;
  
  -- Отримати точку самовивозу з замовлення
  SELECT pickup_point_id INTO point_id FROM orders WHERE id = NEW.order_id;
  
  -- Якщо немає конкретної точки, використати першу з залишком
  IF point_id IS NULL THEN
    SELECT sbpp.pickup_point_id INTO point_id
    FROM stock_by_pickup_point sbpp
    WHERE 
      (NEW.modification_id IS NOT NULL AND sbpp.modification_id = NEW.modification_id)
      OR (NEW.product_id IS NOT NULL AND NEW.modification_id IS NULL AND sbpp.product_id = NEW.product_id)
    AND sbpp.quantity > 0
    ORDER BY sbpp.quantity DESC
    LIMIT 1;
  END IF;
  
  IF point_id IS NOT NULL THEN
    UPDATE stock_by_pickup_point
    SET quantity = GREATEST(0, quantity - NEW.quantity),
        updated_at = now()
    WHERE pickup_point_id = point_id
    AND (
      (NEW.modification_id IS NOT NULL AND modification_id = NEW.modification_id)
      OR (NEW.product_id IS NOT NULL AND NEW.modification_id IS NULL AND product_id = NEW.product_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_decrease_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.decrease_stock_on_order();

-- ============================================
-- Частина 4: Системна точка самовивозу
-- ============================================

-- Створити системний метод доставки "Самовивіз", якщо не існує
INSERT INTO public.shipping_methods (name, code, type, is_active, sort_order)
SELECT 'Самовивіз', 'pickup', 'system', true, 0
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE code = 'pickup');

-- Створити системну точку, якщо немає жодної
INSERT INTO public.pickup_points (name, city, address, method_id, is_system, is_active, sort_order)
SELECT 'Основний склад', 'Київ', 'Системна точка', 
  (SELECT id FROM shipping_methods WHERE code = 'pickup' LIMIT 1),
  true, true, 0
WHERE NOT EXISTS (SELECT 1 FROM pickup_points WHERE is_system = true);