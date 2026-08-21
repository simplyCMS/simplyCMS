
-- Table: product_reviews
CREATE TABLE public.product_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL,
  title text,
  content text,
  images jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  admin_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Validation  trigger for rating 1-5
CREATE OR REPLACE FUNCTION public.validate_review_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_review_before_insert_update
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_review_rating();

-- Updated_at trigger
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: approved visible to all, authors see own, admins see all
CREATE POLICY "Anyone can view approved reviews"
  ON public.product_reviews FOR SELECT
  USING (status = 'approved' OR user_id = auth.uid() OR is_admin());

-- INSERT: authenticated users only, user_id = auth.uid()
CREATE POLICY "Authenticated users can create reviews"
  ON public.product_reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- UPDATE: author can update pending, admins can update any
CREATE POLICY "Authors can update pending reviews"
  ON public.product_reviews FOR UPDATE
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR is_admin()
  );

-- DELETE: author can delete own, admins can delete any
CREATE POLICY "Authors and admins can delete reviews"
  ON public.product_reviews FOR DELETE
  USING (user_id = auth.uid() OR is_admin());

-- Storage bucket for review images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images', 'review-images', true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Storage policies
CREATE POLICY "Review images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-images');

CREATE POLICY "Authenticated users can upload review images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users and admins can delete review images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-images' AND (auth.uid() IS NOT NULL));

-- Bulk ratings function
CREATE OR REPLACE FUNCTION public.get_product_ratings(product_ids uuid[])
RETURNS TABLE(product_id uuid, avg_rating numeric, review_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pr.product_id,
    ROUND(AVG(pr.rating)::numeric, 1) as avg_rating,
    COUNT(*)::integer as review_count
  FROM product_reviews pr
  WHERE pr.product_id = ANY(product_ids) AND pr.status = 'approved'
  GROUP BY pr.product_id;
$$;
