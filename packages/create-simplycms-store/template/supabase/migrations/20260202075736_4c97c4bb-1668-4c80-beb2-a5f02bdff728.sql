-- Plugin registry table
CREATE TABLE public.plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar UNIQUE NOT NULL,
  display_name text NOT NULL,
  version varchar NOT NULL DEFAULT '1.0.0',
  description text,
  author text,
  is_active boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  hooks jsonb DEFAULT '[]',
  migrations_applied jsonb DEFAULT '[]',
  installed_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Plugin events log table
CREATE TABLE public.plugin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_name varchar NOT NULL,
  hook_name varchar NOT NULL,
  payload jsonb,
  result jsonb,
  error text,
  executed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plugin_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for plugins
CREATE POLICY "Admins can manage plugins" 
ON public.plugins 
FOR ALL 
USING (is_admin());

CREATE POLICY "Plugins are viewable by everyone" 
ON public.plugins 
FOR SELECT 
USING (true);

-- RLS policies for plugin_events
CREATE POLICY "Admins can manage plugin events" 
ON public.plugin_events 
FOR ALL 
USING (is_admin());

CREATE POLICY "Plugin events are viewable by admins" 
ON public.plugin_events 
FOR SELECT 
USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_plugins_updated_at
BEFORE UPDATE ON public.plugins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();