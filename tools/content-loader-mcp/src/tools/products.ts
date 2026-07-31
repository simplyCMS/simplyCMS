import { z } from 'zod';
import { supabase } from '../client.js';
import {
  uploadModificationImagesFromUrls,
  uploadProductImagesFromUrls,
} from '../storage.js';

// --- Schemas ---

export const listProductsSchema = z.object({
  section_id: z.string().uuid().optional().describe('Filter by section'),
  include_inactive: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const getProductSchema = z.object({
  id: z.string().uuid().describe('Product ID'),
  include_modifications: z.boolean().optional().default(true),
  include_prices: z.boolean().optional().default(true),
  include_properties: z.boolean().optional().default(true),
});

export const createProductSchema = z.object({
  name: z.string().min(1).describe('Product name'),
  slug: z.string().min(1).describe('URL slug (must be globally unique)'),
  section_id: z.string().uuid().describe('Section/category ID'),
  short_description: z.string().optional(),
  description: z
    .string()
    .optional()
    .describe('HTML description (Tiptap format)'),
  images: z.array(z.string()).optional().describe('Array of image URLs'),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  has_modifications: z.boolean().optional().default(false),
  sku: z
    .string()
    .optional()
    .describe('SKU for simple products (no modifications)'),
  stock_status: z
    .enum(['in_stock', 'out_of_stock', 'on_order'])
    .optional()
    .default('in_stock'),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),

  // Inline price (optional shortcut — sets default price type)
  price: z
    .number()
    .positive()
    .optional()
    .describe('Retail price (default price type)'),
  old_price: z
    .number()
    .positive()
    .optional()
    .describe('Old/strike-through price'),
});

export const createProductFullSchema = z.object({
  // Product fields
  name: z.string().min(1),
  slug: z.string().min(1),
  section_id: z.string().uuid(),
  short_description: z.string().optional(),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  has_modifications: z.boolean().optional().default(false),
  sku: z.string().optional(),
  stock_status: z
    .enum(['in_stock', 'out_of_stock', 'on_order'])
    .optional()
    .default('in_stock'),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),

  // Prices for each price type
  prices: z
    .array(
      z.object({
        price_type_code: z
          .string()
          .describe("Price type code (e.g., 'retail', 'wholesale')"),
        price: z.number().positive(),
        old_price: z.number().positive().optional(),
      }),
    )
    .optional()
    .describe('Prices per price type'),

  // Modifications (variants)
  modifications: z
    .array(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        sku: z.string().optional(),
        stock_status: z
          .enum(['in_stock', 'out_of_stock', 'on_order'])
          .optional()
          .default('in_stock'),
        is_default: z.boolean().optional().default(false),
        images: z.array(z.string()).optional(),
        prices: z
          .array(
            z.object({
              price_type_code: z.string(),
              price: z.number().positive(),
              old_price: z.number().positive().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional()
    .describe('Product modifications/variants'),

  // Property values
  property_values: z
    .array(
      z.object({
        property_slug: z.string().describe('Property slug'),
        value: z.string().optional().describe('Text value'),
        numeric_value: z.number().optional().describe('Numeric value'),
        option_slug: z
          .string()
          .optional()
          .describe('Option slug (for select properties)'),
      }),
    )
    .optional()
    .describe('Product-level property values'),

  // Stock
  stock_quantity: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Stock quantity at system warehouse'),
});

export const deleteProductSchema = z.object({
  id: z.string().uuid().describe('Product ID to delete'),
});

export const updateProductSchema = z.object({
  id: z.string().uuid().describe('Product ID to update'),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  section_id: z.string().uuid().optional(),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  has_modifications: z.boolean().optional(),
  sku: z.string().nullable().optional(),
  stock_status: z.enum(['in_stock', 'out_of_stock', 'on_order']).optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
});

export const createModificationSchema = z.object({
  product_id: z.string().uuid().describe('Parent product ID'),
  name: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().optional(),
  stock_status: z
    .enum(['in_stock', 'out_of_stock', 'on_order'])
    .optional()
    .default('in_stock'),
  is_default: z.boolean().optional().default(false),
  images: z.array(z.string()).optional(),
  sort_order: z.number().int().optional(),
});

export const setPricesSchema = z.object({
  product_id: z.string().uuid(),
  modification_id: z.string().uuid().optional(),
  prices: z.array(
    z.object({
      price_type_code: z.string(),
      price: z.number().positive(),
      old_price: z.number().positive().optional(),
    }),
  ),
});

export const setPropertyValueSchema = z.object({
  product_id: z.string().uuid().optional(),
  modification_id: z.string().uuid().optional(),
  property_slug: z.string(),
  value: z.string().optional(),
  numeric_value: z.number().optional(),
  option_slug: z.string().optional(),
});

// --- Helpers ---

async function getPriceTypeId(code: string): Promise<string> {
  const { data, error } = await supabase
    .from('price_types')
    .select('id')
    .eq('code', code)
    .single();

  if (error || !data) throw new Error(`Price type '${code}' not found`);

  return data.id;
}

async function getDefaultPriceTypeId(): Promise<string> {
  const { data, error } = await supabase
    .from('price_types')
    .select('id')
    .eq('is_default', true)
    .single();

  if (error || !data) throw new Error('Default price type not found');

  return data.id;
}

async function getPropertyBySlug(slug: string) {
  const { data, error } = await supabase
    .from('section_properties')
    .select('id, property_type')
    .eq('slug', slug)
    .single();

  if (error || !data) throw new Error(`Property '${slug}' not found`);

  return data;
}

async function getOptionBySlug(propertyId: string, slug: string) {
  const { data, error } = await supabase
    .from('property_options')
    .select('id, name')
    .eq('property_id', propertyId)
    .eq('slug', slug)
    .single();

  if (error || !data)
    throw new Error(`Option '${slug}' not found for property ${propertyId}`);

  return data;
}

async function getSystemPickupPoint() {
  const { data, error } = await supabase
    .from('pickup_points')
    .select('id')
    .eq('is_system', true)
    .limit(1)
    .single();

  if (error || !data) {
    // Fallback: get any pickup point
    const { data: any, error: anyErr } = await supabase
      .from('pickup_points')
      .select('id')
      .limit(1)
      .single();
    if (anyErr || !any) return null;
    return any;
  }

  return data;
}

// --- Handlers ---

export async function listProducts(input: z.infer<typeof listProductsSchema>) {
  let query = supabase
    .from('products')
    .select(
      'id, name, slug, section_id, is_active, is_featured, has_modifications, sku, stock_status, images, created_at',
    )
    .order('created_at', { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (input.section_id) {
    query = query.eq('section_id', input.section_id);
  }
  if (!input.include_inactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list products: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function getProduct(input: z.infer<typeof getProductSchema>) {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', input.id)
    .single();

  if (error) throw new Error(`Failed to get product: ${error.message}`);

  const result: Record<string, unknown> = { product };

  if (input.include_modifications) {
    const { data: mods } = await supabase
      .from('product_modifications')
      .select('*')
      .eq('product_id', input.id)
      .order('sort_order');
    result.modifications = mods;
  }

  if (input.include_prices) {
    const { data: prices } = await supabase
      .from('product_prices')
      .select('*, price_types(code, name)')
      .eq('product_id', input.id);
    result.prices = prices;
  }

  if (input.include_properties) {
    const { data: props } = await supabase
      .from('product_property_values')
      .select('*, section_properties(name, slug, property_type)')
      .eq('product_id', input.id);
    result.property_values = props;
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function createProduct(
  input: z.infer<typeof createProductSchema>,
) {
  const inputImages = input.images ?? [];

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      slug: input.slug,
      section_id: input.section_id,
      short_description: input.short_description ?? null,
      description: input.description ?? null,
      images: [],
      is_active: input.is_active,
      is_featured: input.is_featured,
      has_modifications: input.has_modifications,
      sku: input.sku ?? null,
      stock_status: input.stock_status,
      meta_title: input.meta_title ?? null,
      meta_description: input.meta_description ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create product: ${error.message}`);

  const warnings: string[] = [];

  if (inputImages.length > 0) {
    const uploaded = await uploadProductImagesFromUrls({
      productId: product.id,
      urls: inputImages,
    });

    warnings.push(...uploaded.warnings);

    const { error: imgError } = await supabase
      .from('products')
      .update({ images: uploaded.images })
      .eq('id', product.id);

    if (imgError) {
      warnings.push(`Images update failed: ${imgError.message}`);
    } else {
      product.images = uploaded.images;
    }
  }

  // Set default price if provided
  if (input.price) {
    const priceTypeId = await getDefaultPriceTypeId();
    await supabase.from('product_prices').insert({
      price_type_id: priceTypeId,
      product_id: product.id,
      price: input.price,
      old_price: input.old_price ?? null,
    });
  }

  return {
    content: [
      {
        type: 'text' as const,
        text:
          `Product created:\n${JSON.stringify(product, null, 2)}` +
          (warnings.length > 0
            ? `\n\nWarnings:\n- ${warnings.join('\n- ')}`
            : ''),
      },
    ],
  };
}

export async function createProductFull(
  input: z.infer<typeof createProductFullSchema>,
) {
  const results: string[] = [];
  const inputImages = input.images ?? [];

  // 1. Create product
  const { data: product, error: prodError } = await supabase
    .from('products')
    .insert({
      name: input.name,
      slug: input.slug,
      section_id: input.section_id,
      short_description: input.short_description ?? null,
      description: input.description ?? null,
      images: [],
      is_active: input.is_active,
      is_featured: input.is_featured,
      has_modifications: input.has_modifications,
      sku: input.sku ?? null,
      stock_status: input.stock_status,
      meta_title: input.meta_title ?? null,
      meta_description: input.meta_description ?? null,
    })
    .select()
    .single();

  if (prodError)
    throw new Error(`Failed to create product: ${prodError.message}`);
  results.push(`Product created: ${product.id} (${product.name})`);

  if (inputImages.length > 0) {
    const uploaded = await uploadProductImagesFromUrls({
      productId: product.id,
      urls: inputImages,
    });

    const { error: imgError } = await supabase
      .from('products')
      .update({ images: uploaded.images })
      .eq('id', product.id);

    if (imgError) {
      results.push(
        `Warning: product images update failed: ${imgError.message}`,
      );
    } else {
      results.push(`Images uploaded: ${uploaded.images.length}`);
    }

    for (const w of uploaded.warnings) {
      results.push(`Warning: ${w}`);
    }
  }

  // 2. Set prices (product-level, for simple products)
  if (input.prices && input.prices.length > 0 && !input.has_modifications) {
    for (const p of input.prices) {
      const priceTypeId = await getPriceTypeId(p.price_type_code);
      const { error } = await supabase.from('product_prices').insert({
        price_type_id: priceTypeId,
        product_id: product.id,
        price: p.price,
        old_price: p.old_price ?? null,
      });
      if (error)
        results.push(
          `Warning: price ${p.price_type_code} failed: ${error.message}`,
        );
      else results.push(`Price set: ${p.price_type_code} = ${p.price}`);
    }
  }

  // 3. Create modifications
  if (input.modifications && input.modifications.length > 0) {
    for (let i = 0; i < input.modifications.length; i++) {
      const mod = input.modifications[i];
      const modInputImages = mod.images ?? [];
      const { data: modification, error: modError } = await supabase
        .from('product_modifications')
        .insert({
          product_id: product.id,
          name: mod.name,
          slug: mod.slug,
          sku: mod.sku ?? null,
          stock_status: mod.stock_status,
          is_default: mod.is_default,
          images: [],
          sort_order: i,
        })
        .select()
        .single();

      if (modError) {
        results.push(
          `Warning: modification '${mod.name}' failed: ${modError.message}`,
        );
        continue;
      }
      results.push(`Modification created: ${modification.id} (${mod.name})`);

      if (modInputImages.length > 0) {
        const uploaded = await uploadModificationImagesFromUrls({
          productId: product.id,
          modificationId: modification.id,
          urls: modInputImages,
        });

        const { error: imgError } = await supabase
          .from('product_modifications')
          .update({ images: uploaded.images })
          .eq('id', modification.id);

        if (imgError) {
          results.push(
            `Warning: mod images update failed (${mod.name}): ${imgError.message}`,
          );
        } else {
          results.push(
            `Mod images uploaded (${mod.name}): ${uploaded.images.length}`,
          );
        }

        for (const w of uploaded.warnings) {
          results.push(`Warning: ${w}`);
        }
      }

      // Set modification prices
      if (mod.prices && mod.prices.length > 0) {
        for (const p of mod.prices) {
          const priceTypeId = await getPriceTypeId(p.price_type_code);
          const { error } = await supabase.from('product_prices').insert({
            price_type_id: priceTypeId,
            product_id: product.id,
            modification_id: modification.id,
            price: p.price,
            old_price: p.old_price ?? null,
          });
          if (error)
            results.push(
              `Warning: mod price ${p.price_type_code} failed: ${error.message}`,
            );
        }
      }
    }
  }

  // 4. Set property values
  if (input.property_values && input.property_values.length > 0) {
    for (const pv of input.property_values) {
      try {
        const property = await getPropertyBySlug(pv.property_slug);
        let optionId: string | null = null;

        if (pv.option_slug) {
          const option = await getOptionBySlug(property.id, pv.option_slug);
          optionId = option.id;
        }

        const { error } = await supabase
          .from('product_property_values')
          .insert({
            product_id: product.id,
            property_id: property.id,
            value: pv.value ?? null,
            numeric_value: pv.numeric_value ?? null,
            option_id: optionId,
          });

        if (error)
          results.push(
            `Warning: property ${pv.property_slug} failed: ${error.message}`,
          );
        else results.push(`Property set: ${pv.property_slug}`);
      } catch (e) {
        results.push(
          `Warning: property ${pv.property_slug} error: ${(e as Error).message}`,
        );
      }
    }
  }

  // 5. Set stock
  if (input.stock_quantity !== undefined) {
    const pickupPoint = await getSystemPickupPoint();
    if (pickupPoint) {
      const stockPayload: Record<string, unknown> = {
        pickup_point_id: pickupPoint.id,
        quantity: input.stock_quantity,
      };

      if (input.has_modifications) {
        // Skip — stock should be set per modification
        results.push(
          'Note: stock_quantity ignored for products with modifications',
        );
      } else {
        stockPayload.product_id = product.id;
        const { error } = await supabase
          .from('stock_by_pickup_point')
          .insert(stockPayload);
        if (error) results.push(`Warning: stock failed: ${error.message}`);
        else results.push(`Stock set: ${input.stock_quantity} units`);
      }
    }
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

export async function deleteProduct(
  input: z.infer<typeof deleteProductSchema>,
) {
  const { error } = await supabase.from('products').delete().eq('id', input.id);

  if (error) throw new Error(`Failed to delete product: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Product ${input.id} deleted (cascaded modifications, prices, properties, stock).`,
      },
    ],
  };
}

export async function updateProduct(
  input: z.infer<typeof updateProductSchema>,
) {
  const { id, ...updates } = input;

  // Remove undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== undefined),
  );

  // Upload images if provided
  if (cleanUpdates.images && Array.isArray(cleanUpdates.images)) {
    const uploadResult = await uploadProductImagesFromUrls({
      productId: id,
      urls: cleanUpdates.images as string[],
    });
    cleanUpdates.images = uploadResult.images;

    // Log warnings if any
    if (uploadResult.warnings.length > 0) {
      console.warn('Image upload warnings:', uploadResult.warnings);
    }
  }

  const { data, error } = await supabase
    .from('products')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update product: ${error.message}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Product updated:\n${JSON.stringify(data, null, 2)}`,
      },
    ],
  };
}

export async function createModification(
  input: z.infer<typeof createModificationSchema>,
) {
  // Get next sort_order
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const { data: existing } = await supabase
      .from('product_modifications')
      .select('sort_order')
      .eq('product_id', input.product_id)
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder =
      existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;
  }

  const { data, error } = await supabase
    .from('product_modifications')
    .insert({
      product_id: input.product_id,
      name: input.name,
      slug: input.slug,
      sku: input.sku ?? null,
      stock_status: input.stock_status,
      is_default: input.is_default,
      images: [],
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create modification: ${error.message}`);

  const warnings: string[] = [];
  const inputImages = input.images ?? [];

  if (inputImages.length > 0) {
    const uploaded = await uploadModificationImagesFromUrls({
      productId: input.product_id,
      modificationId: data.id,
      urls: inputImages,
    });

    warnings.push(...uploaded.warnings);

    const { error: imgError } = await supabase
      .from('product_modifications')
      .update({ images: uploaded.images })
      .eq('id', data.id);

    if (imgError) {
      warnings.push(`Images update failed: ${imgError.message}`);
    } else {
      data.images = uploaded.images;
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text:
          `Modification created:\n${JSON.stringify(data, null, 2)}` +
          (warnings.length > 0
            ? `\n\nWarnings:\n- ${warnings.join('\n- ')}`
            : ''),
      },
    ],
  };
}

export async function setPrices(input: z.infer<typeof setPricesSchema>) {
  const results: string[] = [];

  for (const p of input.prices) {
    const priceTypeId = await getPriceTypeId(p.price_type_code);

    // Check existing
    let query = supabase
      .from('product_prices')
      .select('id')
      .eq('product_id', input.product_id)
      .eq('price_type_id', priceTypeId);

    if (input.modification_id) {
      query = query.eq('modification_id', input.modification_id);
    } else {
      query = query.is('modification_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('product_prices')
        .update({ price: p.price, old_price: p.old_price ?? null })
        .eq('id', existing.id);
      if (error)
        results.push(`Error updating ${p.price_type_code}: ${error.message}`);
      else results.push(`Updated ${p.price_type_code}: ${p.price}`);
    } else {
      const { error } = await supabase.from('product_prices').insert({
        price_type_id: priceTypeId,
        product_id: input.product_id,
        modification_id: input.modification_id ?? null,
        price: p.price,
        old_price: p.old_price ?? null,
      });
      if (error)
        results.push(`Error setting ${p.price_type_code}: ${error.message}`);
      else results.push(`Set ${p.price_type_code}: ${p.price}`);
    }
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

export async function setPropertyValue(
  input: z.infer<typeof setPropertyValueSchema>,
) {
  if (!input.product_id && !input.modification_id)
    throw new Error('Either product_id or modification_id is required');

  const property = await getPropertyBySlug(input.property_slug);
  let optionId: string | null = null;

  if (input.option_slug) {
    const option = await getOptionBySlug(property.id, input.option_slug);
    optionId = option.id;
  }

  const table = input.modification_id
    ? 'modification_property_values'
    : 'product_property_values';
  const entityKey = input.modification_id ? 'modification_id' : 'product_id';
  const entityId = input.modification_id ?? input.product_id;

  // Check existing
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq(entityKey, entityId!)
    .eq('property_id', property.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from(table)
      .update({
        value: input.value ?? null,
        numeric_value: input.numeric_value ?? null,
        option_id: optionId,
      })
      .eq('id', existing.id);
    if (error) throw new Error(`Failed to update property: ${error.message}`);
  } else {
    const { error } = await supabase.from(table).insert({
      [entityKey]: entityId,
      property_id: property.id,
      value: input.value ?? null,
      numeric_value: input.numeric_value ?? null,
      option_id: optionId,
    });
    if (error) throw new Error(`Failed to set property: ${error.message}`);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Property '${input.property_slug}' set for ${entityKey} ${entityId}`,
      },
    ],
  };
}
