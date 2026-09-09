import { z } from 'zod';
import { supabase } from '../client.js';

// --- Schemas ---

export const listPropertiesSchema = z.object({
  section_id: z.string().uuid().optional().describe('Filter by section ID'),
});

export const createPropertySchema = z.object({
  name: z.string().min(1).describe("Property name (e.g., 'Потужність')"),
  slug: z
    .string()
    .min(1)
    .describe("Property slug (e.g., 'power'). Unique within section"),
  property_type: z
    .enum([
      'text',
      'number',
      'select',
      'multiselect',
      'range',
      'color',
      'boolean',
    ])
    .describe('Property data type'),
  section_id: z
    .string()
    .uuid()
    .optional()
    .describe('Section ID (null for global property)'),
  is_filterable: z
    .boolean()
    .optional()
    .default(true)
    .describe('Enable filtering on storefront'),
  is_required: z.boolean().optional().default(false),
  has_page: z
    .boolean()
    .optional()
    .default(false)
    .describe('Generate dedicated page for this property'),
  sort_order: z.number().int().optional().default(0),
});

export const createPropertyOptionSchema = z.object({
  property_id: z.string().uuid().describe('Parent property ID'),
  name: z.string().min(1).describe('Option display name'),
  slug: z.string().min(1).describe('Option slug (unique within property)'),
  sort_order: z.number().int().optional().default(0),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
});

export const assignPropertyToSectionSchema = z.object({
  section_id: z.string().uuid().describe('Target section ID'),
  property_id: z.string().uuid().describe('Property to assign'),
  applies_to: z
    .enum(['product', 'modification'])
    .describe('Level: product-level or modification-level property'),
  sort_order: z.number().int().optional().default(0),
});

export const createPropertyWithOptionsSchema = z.object({
  name: z.string().min(1).describe('Property name'),
  slug: z.string().min(1).describe('Property slug'),
  property_type: z.enum([
    'text',
    'number',
    'select',
    'multiselect',
    'range',
    'color',
    'boolean',
  ]),
  section_id: z.string().uuid().optional(),
  is_filterable: z.boolean().optional().default(true),
  is_required: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
  options: z
    .array(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        sort_order: z.number().int().optional().default(0),
      }),
    )
    .optional()
    .describe('Options for select/multiselect properties'),
  assign_to_section: z
    .object({
      section_id: z.string().uuid(),
      applies_to: z.enum(['product', 'modification']),
    })
    .optional()
    .describe('Auto-assign to section after creation'),
});

// --- Handlers ---

export async function listProperties(
  input: z.infer<typeof listPropertiesSchema>,
) {
  let query = supabase
    .from('section_properties')
    .select(
      'id, name, slug, property_type, section_id, is_filterable, is_required, sort_order',
    )
    .order('sort_order');

  if (input.section_id) {
    query = query.eq('section_id', input.section_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list properties: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function createProperty(
  input: z.infer<typeof createPropertySchema>,
) {
  const { data, error } = await supabase
    .from('section_properties')
    .insert({
      name: input.name,
      slug: input.slug,
      property_type: input.property_type,
      section_id: input.section_id ?? null,
      is_filterable: input.is_filterable,
      is_required: input.is_required,
      has_page: input.has_page,
      sort_order: input.sort_order,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create property: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Property created:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

export async function createPropertyOption(
  input: z.infer<typeof createPropertyOptionSchema>,
) {
  const { data, error } = await supabase
    .from('property_options')
    .insert({
      property_id: input.property_id,
      name: input.name,
      slug: input.slug,
      sort_order: input.sort_order,
      description: input.description ?? null,
      image_url: input.image_url ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create option: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Option created:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

export async function assignPropertyToSection(
  input: z.infer<typeof assignPropertyToSectionSchema>,
) {
  const { data, error } = await supabase
    .from('section_property_assignments')
    .insert({
      section_id: input.section_id,
      property_id: input.property_id,
      applies_to: input.applies_to,
      sort_order: input.sort_order,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to assign property: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Property assigned to section:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

export async function createPropertyWithOptions(
  input: z.infer<typeof createPropertyWithOptionsSchema>,
) {
  // 1. Create property
  const { data: property, error: propError } = await supabase
    .from('section_properties')
    .insert({
      name: input.name,
      slug: input.slug,
      property_type: input.property_type,
      section_id: input.section_id ?? null,
      is_filterable: input.is_filterable,
      is_required: input.is_required,
      sort_order: input.sort_order,
    })
    .select()
    .single();

  if (propError)
    throw new Error(`Failed to create property: ${propError.message}`);

  const results: string[] = [
    `Property created: ${property.id} (${property.name})`,
  ];

  // 2. Create options if provided
  if (input.options && input.options.length > 0) {
    const optionsToInsert = input.options.map((opt, idx) => ({
      property_id: property.id,
      name: opt.name,
      slug: opt.slug,
      sort_order: opt.sort_order ?? idx,
    }));

    const { data: options, error: optError } = await supabase
      .from('property_options')
      .insert(optionsToInsert)
      .select();

    if (optError)
      throw new Error(
        `Property created but options failed: ${optError.message}`,
      );

    results.push(`Created ${options.length} options`);
  }

  // 3. Assign to section if specified
  if (input.assign_to_section) {
    const { error: assignError } = await supabase
      .from('section_property_assignments')
      .insert({
        section_id: input.assign_to_section.section_id,
        property_id: property.id,
        applies_to: input.assign_to_section.applies_to,
        sort_order: input.sort_order,
      });

    if (assignError)
      results.push(`Warning: assignment failed: ${assignError.message}`);
    else
      results.push(
        `Assigned to section ${input.assign_to_section.section_id} (${input.assign_to_section.applies_to})`,
      );
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: results.join('\n'),
      },
    ],
  };
}
