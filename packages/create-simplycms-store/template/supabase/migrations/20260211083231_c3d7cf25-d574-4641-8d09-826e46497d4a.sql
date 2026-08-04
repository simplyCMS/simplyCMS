
-- Step 1: Add price_type_id to discounts table
ALTER TABLE public.discounts 
ADD COLUMN price_type_id uuid REFERENCES public.price_types(id);

-- Step 2: Copy price_type_id from parent group to each discount
UPDATE public.discounts d
SET price_type_id = dg.price_type_id
FROM public.discount_groups dg
WHERE d.group_id = dg.id;

-- Step 3: Make price_type_id NOT NULL on discounts (after backfill)
ALTER TABLE public.discounts 
ALTER COLUMN price_type_id SET NOT NULL;

-- Step 4: Drop the foreign key and column from discount_groups
ALTER TABLE public.discount_groups 
DROP COLUMN price_type_id;
