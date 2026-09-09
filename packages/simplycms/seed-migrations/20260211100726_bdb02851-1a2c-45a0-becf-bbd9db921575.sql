
-- 1. Add new columns to banners table
ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buttons jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS date_from timestamptz,
  ADD COLUMN IF NOT EXISTS date_to timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_days integer[],
  ADD COLUMN IF NOT EXISTS schedule_time_from time,
  ADD COLUMN IF NOT EXISTS schedule_time_to time,
  ADD COLUMN IF NOT EXISTS slide_duration integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS animation_type text NOT NULL DEFAULT 'slide',
  ADD COLUMN IF NOT EXISTS animation_duration integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS overlay_color text DEFAULT 'rgba(0,0,0,0.4)',
  ADD COLUMN IF NOT EXISTS text_position text NOT NULL DEFAULT 'left',
  ADD COLUMN IF NOT EXISTS desktop_image_url text,
  ADD COLUMN IF NOT EXISTS mobile_image_url text;

-- 2. Migrate existing button_text + link_url into buttons jsonb
UPDATE public.banners
SET buttons = jsonb_build_array(
  jsonb_build_object(
    'text', button_text,
    'url', COALESCE(link_url, ''),
    'target', '_self',
    'variant', 'primary'
  )
)
WHERE button_text IS NOT NULL AND button_text != '';

-- Also migrate link_url for banners that have link but no button text
UPDATE public.banners
SET buttons = jsonb_build_array(
  jsonb_build_object(
    'text', 'Детальніше',
    'url', link_url,
    'target', '_self',
    'variant', 'primary'
  )
)
WHERE (button_text IS NULL OR button_text = '') AND link_url IS NOT NULL AND link_url != ''
  AND (buttons IS NULL OR buttons = '[]'::jsonb);

-- 3. Drop old columns
ALTER TABLE public.banners DROP COLUMN IF EXISTS button_text;
ALTER TABLE public.banners DROP COLUMN IF EXISTS link_url;

-- 4. Create banner-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies for banner-images bucket
CREATE POLICY "Banner images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'banner-images');

CREATE POLICY "Admins can upload banner images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'banner-images' AND public.is_admin());

CREATE POLICY "Admins can update banner images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'banner-images' AND public.is_admin());

CREATE POLICY "Admins can delete banner images"
ON storage.objects FOR DELETE
USING (bucket_id = 'banner-images' AND public.is_admin());

-- 6. Add index for placement queries
CREATE INDEX IF NOT EXISTS idx_banners_placement ON public.banners(placement);
CREATE INDEX IF NOT EXISTS idx_banners_section_id ON public.banners(section_id);
