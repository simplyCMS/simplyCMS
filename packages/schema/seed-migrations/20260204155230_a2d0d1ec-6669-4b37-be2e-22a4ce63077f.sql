
-- =====================================================
-- USER MANAGEMENT SYSTEM MIGRATION
-- =====================================================

-- 1. Create user_category_history table
CREATE TABLE public.user_category_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_category_id uuid REFERENCES public.user_categories(id) ON DELETE SET NULL,
  to_category_id uuid NOT NULL REFERENCES public.user_categories(id) ON DELETE CASCADE,
  reason text,
  rule_id uuid,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Create category_rules table
CREATE TABLE public.category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  from_category_id uuid REFERENCES public.user_categories(id) ON DELETE SET NULL,
  to_category_id uuid NOT NULL REFERENCES public.user_categories(id) ON DELETE CASCADE,
  conditions jsonb NOT NULL DEFAULT '{"type": "all", "rules": []}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key for rule_id in history
ALTER TABLE public.user_category_history 
  ADD CONSTRAINT user_category_history_rule_id_fkey 
  FOREIGN KEY (rule_id) REFERENCES public.category_rules(id) ON DELETE SET NULL;

-- 3. Create user_addresses table
CREATE TABLE public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  address text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Create user_recipients table
CREATE TABLE public.user_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text NOT NULL,
  address text NOT NULL,
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS default_shipping_method_id uuid REFERENCES public.shipping_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_pickup_point_id uuid REFERENCES public.pickup_points(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auth_provider text,
  ADD COLUMN IF NOT EXISTS registration_utm jsonb DEFAULT '{}'::jsonb;

-- 6. Add recipient columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS has_different_recipient boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_first_name text,
  ADD COLUMN IF NOT EXISTS recipient_last_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS saved_recipient_id uuid REFERENCES public.user_recipients(id) ON DELETE SET NULL;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.user_category_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recipients ENABLE ROW LEVEL SECURITY;

-- user_category_history policies
CREATE POLICY "Admins can manage category history"
  ON public.user_category_history FOR ALL
  USING (is_admin());

CREATE POLICY "Users can view own category history"
  ON public.user_category_history FOR SELECT
  USING (auth.uid() = user_id);

-- category_rules policies
CREATE POLICY "Admins can manage category rules"
  ON public.category_rules FOR ALL
  USING (is_admin());

CREATE POLICY "Category rules are viewable by admins"
  ON public.category_rules FOR SELECT
  USING (is_admin());

-- user_addresses policies
CREATE POLICY "Users can manage own addresses"
  ON public.user_addresses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all addresses"
  ON public.user_addresses FOR SELECT
  USING (is_admin());

-- user_recipients policies
CREATE POLICY "Users can manage own recipients"
  ON public.user_recipients FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all recipients"
  ON public.user_recipients FOR SELECT
  USING (is_admin());

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function to get user statistics for category rules
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS TABLE (
  total_purchases numeric,
  orders_count integer,
  registration_days integer,
  email_domain text,
  auth_provider text,
  utm_source text,
  utm_campaign text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  -- Get profile info
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(o.total) 
      FROM orders o 
      JOIN order_statuses os ON os.id = o.status_id 
      WHERE o.user_id = p_user_id AND os.code = 'completed'
    ), 0) as total_purchases,
    COALESCE((
      SELECT COUNT(*)::integer 
      FROM orders o 
      JOIN order_statuses os ON os.id = o.status_id 
      WHERE o.user_id = p_user_id AND os.code = 'completed'
    ), 0) as orders_count,
    COALESCE(EXTRACT(DAY FROM (now() - v_profile.created_at))::integer, 0) as registration_days,
    CASE 
      WHEN v_profile.email IS NOT NULL AND v_profile.email LIKE '%@%'
      THEN split_part(v_profile.email, '@', 2)
      ELSE NULL
    END as email_domain,
    v_profile.auth_provider,
    v_profile.registration_utm->>'utm_source',
    v_profile.registration_utm->>'utm_campaign';
END;
$$;

-- Function to check and apply category rules for a user
CREATE OR REPLACE FUNCTION public.check_category_rules(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_stats RECORD;
  v_current_category_id uuid;
  v_conditions_met boolean;
  v_rule_item jsonb;
  v_field text;
  v_operator text;
  v_value text;
  v_changed boolean := false;
BEGIN
  -- Get current user category
  SELECT category_id INTO v_current_category_id
  FROM profiles WHERE user_id = p_user_id;
  
  -- Get user stats
  SELECT * INTO v_stats FROM get_user_stats(p_user_id);
  
  -- Iterate through active rules ordered by priority
  FOR v_rule IN 
    SELECT * FROM category_rules 
    WHERE is_active = true 
    AND (from_category_id IS NULL OR from_category_id = v_current_category_id)
    ORDER BY priority DESC
  LOOP
    v_conditions_met := true;
    
    -- Check each condition
    FOR v_rule_item IN SELECT * FROM jsonb_array_elements(v_rule.conditions->'rules')
    LOOP
      v_field := v_rule_item->>'field';
      v_operator := v_rule_item->>'operator';
      v_value := v_rule_item->>'value';
      
      -- Evaluate condition based on field type
      CASE v_field
        WHEN 'total_purchases' THEN
          v_conditions_met := v_conditions_met AND (
            CASE v_operator
              WHEN '>=' THEN v_stats.total_purchases >= v_value::numeric
              WHEN '>' THEN v_stats.total_purchases > v_value::numeric
              WHEN '<=' THEN v_stats.total_purchases <= v_value::numeric
              WHEN '<' THEN v_stats.total_purchases < v_value::numeric
              WHEN '=' THEN v_stats.total_purchases = v_value::numeric
              ELSE false
            END
          );
        WHEN 'registration_days' THEN
          v_conditions_met := v_conditions_met AND (
            CASE v_operator
              WHEN '>=' THEN v_stats.registration_days >= v_value::integer
              WHEN '>' THEN v_stats.registration_days > v_value::integer
              WHEN '<=' THEN v_stats.registration_days <= v_value::integer
              WHEN '<' THEN v_stats.registration_days < v_value::integer
              WHEN '=' THEN v_stats.registration_days = v_value::integer
              ELSE false
            END
          );
        WHEN 'orders_count' THEN
          v_conditions_met := v_conditions_met AND (
            CASE v_operator
              WHEN '>=' THEN v_stats.orders_count >= v_value::integer
              WHEN '>' THEN v_stats.orders_count > v_value::integer
              WHEN '<=' THEN v_stats.orders_count <= v_value::integer
              WHEN '<' THEN v_stats.orders_count < v_value::integer
              WHEN '=' THEN v_stats.orders_count = v_value::integer
              ELSE false
            END
          );
        WHEN 'email_domain' THEN
          v_conditions_met := v_conditions_met AND (
            CASE v_operator
              WHEN '=' THEN v_stats.email_domain = v_value
              WHEN 'contains' THEN v_stats.email_domain LIKE '%' || v_value || '%'
              ELSE false
            END
          );
        WHEN 'auth_provider' THEN
          v_conditions_met := v_conditions_met AND (v_stats.auth_provider = v_value);
        WHEN 'utm_source' THEN
          v_conditions_met := v_conditions_met AND (
            CASE v_operator
              WHEN '=' THEN v_stats.utm_source = v_value
              WHEN 'contains' THEN v_stats.utm_source LIKE '%' || v_value || '%'
              ELSE false
            END
          );
        WHEN 'utm_campaign' THEN
          v_conditions_met := v_conditions_met AND (
            CASE v_operator
              WHEN '=' THEN v_stats.utm_campaign = v_value
              WHEN 'contains' THEN v_stats.utm_campaign LIKE '%' || v_value || '%'
              ELSE false
            END
          );
        ELSE
          v_conditions_met := false;
      END CASE;
      
      -- Exit early if any condition fails (for "all" type)
      IF NOT v_conditions_met AND v_rule.conditions->>'type' = 'all' THEN
        EXIT;
      END IF;
    END LOOP;
    
    -- If all conditions met, update category
    IF v_conditions_met AND v_rule.to_category_id != v_current_category_id THEN
      -- Update user category
      UPDATE profiles SET category_id = v_rule.to_category_id WHERE user_id = p_user_id;
      
      -- Record history
      INSERT INTO user_category_history (user_id, from_category_id, to_category_id, reason, rule_id)
      VALUES (p_user_id, v_current_category_id, v_rule.to_category_id, 'Автоматично за правилом: ' || v_rule.name, v_rule.id);
      
      v_changed := true;
      EXIT; -- Apply only first matching rule
    END IF;
  END LOOP;
  
  RETURN v_changed;
END;
$$;

-- Function to check all users (for manual run)
CREATE OR REPLACE FUNCTION public.check_all_users_category_rules()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_user_id IN SELECT user_id FROM profiles
  LOOP
    IF check_category_rules(v_user_id) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Trigger function to check rules when order status changes
CREATE OR REPLACE FUNCTION public.check_category_on_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_code text;
BEGIN
  -- Only process if status changed
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    -- Get the new status code
    SELECT code INTO v_status_code FROM order_statuses WHERE id = NEW.status_id;
    
    -- If order completed and has user_id, check category rules
    IF v_status_code = 'completed' AND NEW.user_id IS NOT NULL THEN
      PERFORM check_category_rules(NEW.user_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders
DROP TRIGGER IF EXISTS trigger_check_category_on_order_complete ON orders;
CREATE TRIGGER trigger_check_category_on_order_complete
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_category_on_order_complete();

-- Function to toggle admin role
CREATE OR REPLACE FUNCTION public.toggle_user_admin(p_user_id uuid, p_is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  
  IF p_is_admin THEN
    -- Add admin role if not exists
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Remove admin role
    DELETE FROM user_roles WHERE user_id = p_user_id AND role = 'admin';
  END IF;
END;
$$;

-- =====================================================
-- STORAGE BUCKET FOR AVATARS
-- =====================================================

-- Create bucket for user avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for user avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can manage all avatars"
  ON storage.objects FOR ALL
  USING (bucket_id = 'user-avatars' AND is_admin());
