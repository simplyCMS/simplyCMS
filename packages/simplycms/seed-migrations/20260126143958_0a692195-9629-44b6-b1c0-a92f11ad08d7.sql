-- Add applies_to column to section_property_assignments to specify if property applies to products, modifications, or both
ALTER TABLE public.section_property_assignments 
ADD COLUMN applies_to TEXT NOT NULL DEFAULT 'product' CHECK (applies_to IN ('product', 'modification'));