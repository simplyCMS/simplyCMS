-- Add saved_address_id column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS saved_address_id uuid REFERENCES public.user_addresses(id) ON DELETE SET NULL;

-- Update saved_recipient_id constraint to ON DELETE SET NULL
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_saved_recipient_id_fkey;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_saved_recipient_id_fkey 
FOREIGN KEY (saved_recipient_id) 
REFERENCES public.user_recipients(id) 
ON DELETE SET NULL;