-- Add secure access token for guest orders
ALTER TABLE public.orders 
ADD COLUMN access_token TEXT;

-- Generate access tokens for existing guest orders
UPDATE public.orders 
SET access_token = encode(gen_random_bytes(32), 'hex')
WHERE user_id IS NULL AND access_token IS NULL;

-- Create trigger to auto-generate access token for guest orders
CREATE OR REPLACE FUNCTION public.generate_guest_order_access_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.access_token IS NULL THEN
    NEW.access_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_guest_order_token
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_guest_order_access_token();

-- Drop existing SELECT policy for users viewing own orders
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

-- Create new policy: authenticated users can view their orders, guest orders require access_token
-- Note: Guest order access will be handled via edge function that validates the token
CREATE POLICY "Users can view own orders" 
ON public.orders 
FOR SELECT 
USING (
  -- Authenticated users can see their own orders
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  -- Admins can see all orders (handled by separate admin policy)
);

-- Update order_items policy to be more restrictive for guest orders
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;

CREATE POLICY "Users can view own order items" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  )
);