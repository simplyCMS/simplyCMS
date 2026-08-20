-- Make section_properties global (section_id becomes nullable)
ALTER TABLE public.section_properties 
  ALTER COLUMN section_id DROP NOT NULL;

-- Create a junction table for section-property relationships
CREATE TABLE IF NOT EXISTS public.section_property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.section_properties(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(section_id, property_id)
);

-- Enable RLS
ALTER TABLE public.section_property_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Section property assignments are viewable by everyone" 
  ON public.section_property_assignments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Admins can manage section property assignments" 
  ON public.section_property_assignments 
  FOR ALL 
  USING (is_admin());

-- Create indexes
CREATE INDEX idx_section_property_assignments_section 
  ON public.section_property_assignments(section_id);
CREATE INDEX idx_section_property_assignments_property 
  ON public.section_property_assignments(property_id);

-- Migrate existing data: create assignments for existing section_id relationships
INSERT INTO public.section_property_assignments (section_id, property_id, sort_order)
SELECT section_id, id, sort_order 
FROM public.section_properties 
WHERE section_id IS NOT NULL
ON CONFLICT (section_id, property_id) DO NOTHING;