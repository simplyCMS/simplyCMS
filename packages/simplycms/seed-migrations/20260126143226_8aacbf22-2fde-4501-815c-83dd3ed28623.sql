-- Create table for modification property values
CREATE TABLE public.modification_property_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modification_id UUID NOT NULL REFERENCES public.product_modifications(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.section_properties(id) ON DELETE CASCADE,
    value TEXT,
    numeric_value NUMERIC,
    option_id UUID REFERENCES public.property_options(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(modification_id, property_id)
);

-- Enable RLS
ALTER TABLE public.modification_property_values ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Modification property values are viewable by everyone" 
ON public.modification_property_values 
FOR SELECT USING (true);

CREATE POLICY "Admins can manage modification property values" 
ON public.modification_property_values 
FOR ALL USING (is_admin());

-- Index for faster lookups
CREATE INDEX idx_modification_property_values_mod ON public.modification_property_values(modification_id);
CREATE INDEX idx_modification_property_values_option ON public.modification_property_values(option_id);