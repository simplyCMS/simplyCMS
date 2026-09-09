-- Add page fields directly to property_options
ALTER TABLE public.property_options 
ADD COLUMN description TEXT,
ADD COLUMN image_url TEXT,
ADD COLUMN meta_title TEXT,
ADD COLUMN meta_description TEXT;

-- Migrate existing data from property_pages to property_options
UPDATE public.property_options po
SET 
  description = pp.description,
  image_url = pp.image_url,
  meta_title = pp.meta_title,
  meta_description = pp.meta_description
FROM public.property_pages pp
WHERE pp.option_id = po.id;

-- Drop the property_pages table
DROP TABLE public.property_pages;