-- Рефакторинг системи тем: Build-time Registration, Runtime Activation
-- 1. Прибрати settings_schema (джерело істини — manifest у коді)
-- 2. Перейменувати config → settings (значення налаштувань)
-- 3. Перейменувати installed_at → created_at (стандартна конвенція)
-- 4. Зробити is_active NOT NULL DEFAULT false
-- 5. Оновити seed-дані default теми
-- 6. Додати solarstore тему
-- 7. Видалити system_settings.active_theme (дублює themes.is_active)

-- Крок 1: Структурні зміни таблиці themes
ALTER TABLE public.themes DROP COLUMN IF EXISTS settings_schema;
ALTER TABLE public.themes RENAME COLUMN config TO settings;
ALTER TABLE public.themes RENAME COLUMN installed_at TO created_at;
ALTER TABLE public.themes ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.themes ALTER COLUMN is_active SET DEFAULT false;

-- Крок 2: Оновити seed default теми (привести у відповідність з manifest.ts)
UPDATE public.themes SET
  display_name = 'Default Theme',
  version = '0.1.0',
  description = 'Default SimplyCMS theme with modern e-commerce design',
  author = 'SimplyCMS'
WHERE name = 'default';

-- Крок 3: Додати solarstore тему (якщо ще не існує)
INSERT INTO public.themes (name, display_name, version, description, author, is_active, settings)
VALUES (
  'solarstore',
  'SolarStore Default',
  '1.0.0',
  'SolarStore theme — blue palette for solar energy equipment store',
  'SimplyCMS',
  false,
  '{}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Крок 4: Видалити system_settings.active_theme (дублює themes.is_active)
DELETE FROM public.system_settings WHERE key = 'active_theme';
