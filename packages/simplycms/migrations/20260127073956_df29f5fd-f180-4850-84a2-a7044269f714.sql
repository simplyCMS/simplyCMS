-- Rename 'code' column to 'slug' in section_properties table
ALTER TABLE public.section_properties 
  RENAME COLUMN code TO slug;