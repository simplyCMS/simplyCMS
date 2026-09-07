-- Fix 1: Prevent users from self-assigning category_id (pricing tier)
-- Drop existing policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new policy with WITH CHECK to prevent category_id changes
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND (
      category_id IS NOT DISTINCT FROM (SELECT p.category_id FROM public.profiles p WHERE p.user_id = auth.uid())
    )
  );

-- Fix 2: Service requests - prevent viewing of NULL user_id records by non-admins
DROP POLICY IF EXISTS "Users can view own service requests" ON public.service_requests;

CREATE POLICY "Users can view own service requests" ON public.service_requests
  FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR is_admin()
  );

-- Fix 3: Add admin RPC for updating user categories (only admins can change pricing tiers)
CREATE OR REPLACE FUNCTION public.admin_update_user_category(
  target_user_id UUID,
  new_category_id UUID
)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change user categories';
  END IF;
  
  UPDATE public.profiles 
  SET category_id = new_category_id
  WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;