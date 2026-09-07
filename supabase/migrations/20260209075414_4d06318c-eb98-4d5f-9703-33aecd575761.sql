-- Create themes table for the theme system
CREATE TABLE public.themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  display_name text NOT NULL,
  version varchar(20) NOT NULL DEFAULT '1.0.0',
  description text,
  author text,
  preview_image text,
  is_active boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  settings_schema jsonb DEFAULT '{}',
  installed_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Constraint: only one theme can be active at a time
CREATE UNIQUE INDEX themes_active_idx ON public.themes (is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

-- Themes are viewable by everyone (needed for frontend to load active theme)
CREATE POLICY "Themes are viewable by everyone"
  ON public.themes FOR SELECT USING (true);

-- Only admins can manage themes
CREATE POLICY "Admins can manage themes"
  ON public.themes FOR ALL
  USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_themes_updated_at
  BEFORE UPDATE ON public.themes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default theme
INSERT INTO public.themes (name, display_name, version, description, author, is_active, settings_schema)
VALUES (
  'default',
  'SolarStore Default',
  '1.0.0',
  'Стандартна тема SolarStore з підтримкою світлої/темної теми',
  'SolarStore Team',
  true,
  '{
    "primaryColor": {
      "type": "color",
      "default": "#1192DC",
      "label": "Основний колір"
    },
    "showBrandInHeader": {
      "type": "boolean",
      "default": true,
      "label": "Показувати логотип у хедері"
    },
    "productsPerRow": {
      "type": "select",
      "default": "4",
      "label": "Товарів у рядку",
      "options": [
        { "value": "3", "label": "3 товари" },
        { "value": "4", "label": "4 товари" },
        { "value": "5", "label": "5 товарів" }
      ]
    }
  }'::jsonb
);

-- Add active_theme to system_settings
INSERT INTO public.system_settings (key, value, description)
VALUES ('active_theme', '"default"', 'Активна тема сайту')
ON CONFLICT (key) DO NOTHING;