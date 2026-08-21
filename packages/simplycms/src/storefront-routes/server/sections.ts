import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { loadSections, loadSectionBySlug } from 'simplycms/storefront/loaders';
import { createServerSupabase } from 'simplycms/supabase/server-client';

/** Отримати всі активні секції */
export const getSections = createServerFn({ method: 'GET' }).handler(async () =>
  loadSections(createServerSupabase()),
);

/** Отримати секцію за slug */
export const getSectionBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return loadSectionBySlug(createServerSupabase(), slug);
  });
