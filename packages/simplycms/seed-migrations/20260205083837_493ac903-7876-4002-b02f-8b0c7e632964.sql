-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage categories" ON public.user_categories;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.user_categories;
DROP POLICY IF EXISTS "Admins can manage category rules" ON public.category_rules;
DROP POLICY IF EXISTS "Category rules are viewable by admins" ON public.category_rules;

-- Create proper policies for user_categories
CREATE POLICY "Categories are viewable by everyone" 
ON public.user_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert categories" 
ON public.user_categories 
FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update categories" 
ON public.user_categories 
FOR UPDATE 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete categories" 
ON public.user_categories 
FOR DELETE 
USING (public.is_admin());

-- Create proper policies for category_rules
CREATE POLICY "Category rules are viewable by admins" 
ON public.category_rules 
FOR SELECT 
USING (public.is_admin());

CREATE POLICY "Admins can insert category rules" 
ON public.category_rules 
FOR INSERT 
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update category rules" 
ON public.category_rules 
FOR UPDATE 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete category rules" 
ON public.category_rules 
FOR DELETE 
USING (public.is_admin());