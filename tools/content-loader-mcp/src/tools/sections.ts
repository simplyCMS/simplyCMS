import { z } from 'zod';
import { supabase } from '../client.js';

// --- Schemas ---

export const listSectionsSchema = z.object({
  parent_id: z
    .string()
    .uuid()
    .optional()
    .describe('Filter by parent section ID (for subcategories)'),
  include_inactive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include inactive sections'),
});

export const createSectionSchema = z.object({
  name: z.string().min(1).describe("Section name (e.g., 'Інвертори')"),
  slug: z
    .string()
    .min(1)
    .describe("URL slug (e.g., 'invertory'). Must be unique"),
  description: z.string().optional().describe('Section description'),
  parent_id: z
    .string()
    .uuid()
    .optional()
    .describe('Parent section ID for subcategories'),
  image_url: z.string().url().optional().describe('Section image URL'),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
  meta_title: z.string().optional().describe('SEO title'),
  meta_description: z.string().optional().describe('SEO description'),
});

export const updateSectionSchema = z.object({
  id: z.string().uuid().describe('Section ID to update'),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
});

export const deleteSectionSchema = z.object({
  id: z.string().uuid().describe('Section ID to delete'),
});

// --- Handlers ---

export async function listSections(input: z.infer<typeof listSectionsSchema>) {
  let query = supabase
    .from('sections')
    .select(
      'id, name, slug, parent_id, is_active, sort_order, image_url, meta_title',
    )
    .order('sort_order');

  if (input.parent_id) {
    query = query.eq('parent_id', input.parent_id);
  }
  if (!input.include_inactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list sections: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function createSection(
  input: z.infer<typeof createSectionSchema>,
) {
  const { data, error } = await supabase
    .from('sections')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      parent_id: input.parent_id ?? null,
      image_url: input.image_url ?? null,
      is_active: input.is_active,
      sort_order: input.sort_order,
      meta_title: input.meta_title ?? null,
      meta_description: input.meta_description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create section: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Section created successfully:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

export async function updateSection(
  input: z.infer<typeof updateSectionSchema>,
) {
  const { id, ...updates } = input;

  // Remove undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );

  const { data, error } = await supabase
    .from('sections')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update section: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Section updated:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

export async function deleteSection(
  input: z.infer<typeof deleteSectionSchema>,
) {
  const { error } = await supabase.from('sections').delete().eq('id', input.id);

  if (error) throw new Error(`Failed to delete section: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Section ${input.id} deleted successfully.`,
      },
    ],
  };
}
