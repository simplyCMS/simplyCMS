-- 1. Створюємо таблицю property_options для зберігання опцій властивостей
CREATE TABLE public.property_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.section_properties(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(property_id, slug)
);

-- 2. Включаємо RLS для property_options
ALTER TABLE public.property_options ENABLE ROW LEVEL SECURITY;

-- 3. RLS політики для property_options
CREATE POLICY "Property options are viewable by everyone"
ON public.property_options
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage property options"
ON public.property_options
FOR ALL
USING (is_admin());

-- 4. Додаємо option_id до product_property_values
ALTER TABLE public.product_property_values
ADD COLUMN option_id UUID REFERENCES public.property_options(id) ON DELETE SET NULL;

-- 5. Оновлюємо property_pages: спочатку робимо property_id nullable, 
-- потім додаємо option_id, і врешті видалимо property_id після міграції даних
ALTER TABLE public.property_pages
ADD COLUMN option_id UUID REFERENCES public.property_options(id) ON DELETE CASCADE;

-- Робимо property_id nullable для перехідного періоду
ALTER TABLE public.property_pages
ALTER COLUMN property_id DROP NOT NULL;

-- 6. Створюємо індекси для кращої продуктивності
CREATE INDEX idx_property_options_property_id ON public.property_options(property_id);
CREATE INDEX idx_property_options_slug ON public.property_options(slug);
CREATE INDEX idx_product_property_values_option_id ON public.product_property_values(option_id);