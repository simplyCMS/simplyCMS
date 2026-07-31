#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  listSectionsSchema,
  createSectionSchema,
  updateSectionSchema,
  deleteSectionSchema,
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from './tools/sections.js';

import {
  listPropertiesSchema,
  createPropertySchema,
  createPropertyOptionSchema,
  assignPropertyToSectionSchema,
  createPropertyWithOptionsSchema,
  listProperties,
  createProperty,
  createPropertyOption,
  assignPropertyToSection,
  createPropertyWithOptions,
} from './tools/properties.js';

import {
  listProductsSchema,
  getProductSchema,
  createProductSchema,
  createProductFullSchema,
  deleteProductSchema,
  updateProductSchema,
  createModificationSchema,
  setPricesSchema,
  setPropertyValueSchema,
  listProducts,
  getProduct,
  createProduct,
  createProductFull,
  deleteProduct,
  updateProduct,
  createModification,
  setPrices,
  setPropertyValue,
} from './tools/products.js';

import {
  seedInvertersSchema,
  seedFromJsonSchema,
  seedInverters,
  seedFromJson,
} from './tools/seed.js';

import {
  scrapeUrlSchema,
  scrapeProductListSchema,
  scrapeProductPageSchema,
  scrapeUrl,
  scrapeProductList,
  scrapeProductPage,
} from './tools/scraper.js';

const server = new McpServer({
  name: 'simplycms-content-loader',
  version: '1.0.0',
});

// ==========================================
// Section Tools
// ==========================================

server.tool(
  'list_sections',
  'List all sections (categories) in the CMS. Returns id, name, slug, parent_id, is_active.',
  listSectionsSchema.shape,
  async (input) => listSections(listSectionsSchema.parse(input)),
);

server.tool(
  'create_section',
  'Create a new section (category). Supports hierarchy via parent_id, SEO fields, and image.',
  createSectionSchema.shape,
  async (input) => createSection(createSectionSchema.parse(input)),
);

server.tool(
  'update_section',
  'Update an existing section by ID. Only provided fields will be updated.',
  updateSectionSchema.shape,
  async (input) => updateSection(updateSectionSchema.parse(input)),
);

server.tool(
  'delete_section',
  'Delete a section by ID. Warning: cascades to products in this section.',
  deleteSectionSchema.shape,
  async (input) => deleteSection(deleteSectionSchema.parse(input)),
);

// ==========================================
// Property Tools
// ==========================================

server.tool(
  'list_properties',
  'List section properties (product attributes). Optionally filter by section_id.',
  listPropertiesSchema.shape,
  async (input) => listProperties(listPropertiesSchema.parse(input)),
);

server.tool(
  'create_property',
  'Create a single property definition (text, number, select, multiselect, color, boolean, range).',
  createPropertySchema.shape,
  async (input) => createProperty(createPropertySchema.parse(input)),
);

server.tool(
  'create_property_option',
  'Add an option to a select/multiselect property.',
  createPropertyOptionSchema.shape,
  async (input) =>
    createPropertyOption(createPropertyOptionSchema.parse(input)),
);

server.tool(
  'assign_property_to_section',
  "Assign a property to a section. Specify applies_to: 'product' or 'modification'.",
  assignPropertyToSectionSchema.shape,
  async (input) =>
    assignPropertyToSection(assignPropertyToSectionSchema.parse(input)),
);

server.tool(
  'create_property_full',
  'Create a property with options and auto-assign to section in one call.',
  createPropertyWithOptionsSchema.shape,
  async (input) =>
    createPropertyWithOptions(createPropertyWithOptionsSchema.parse(input)),
);

// ==========================================
// Product Tools
// ==========================================

server.tool(
  'list_products',
  'List products with optional section filter. Returns basic info: id, name, slug, images, prices.',
  listProductsSchema.shape,
  async (input) => listProducts(listProductsSchema.parse(input)),
);

server.tool(
  'get_product',
  'Get full product details including modifications, prices, and property values.',
  getProductSchema.shape,
  async (input) => getProduct(getProductSchema.parse(input)),
);

server.tool(
  'create_product',
  'Create a simple product. Optionally set price (default price type). For complex products with modifications and properties, use create_product_full.',
  createProductSchema.shape,
  async (input) => createProduct(createProductSchema.parse(input)),
);

server.tool(
  'create_product_full',
  'Create a product with all relations: prices (per type), modifications (variants), property values, and stock — in one atomic call.',
  createProductFullSchema.shape,
  async (input) => createProductFull(createProductFullSchema.parse(input)),
);

server.tool(
  'delete_product',
  'Delete a product and all related data (modifications, prices, properties, stock).',
  deleteProductSchema.shape,
  async (input) => deleteProduct(deleteProductSchema.parse(input)),
);

server.tool(
  'update_product',
  'Update an existing product. Only provided fields will be updated. Images will be uploaded to Supabase Storage.',
  updateProductSchema.shape,
  async (input) => updateProduct(updateProductSchema.parse(input)),
);

server.tool(
  'create_modification',
  'Add a modification (variant) to a product. Set images, SKU, stock status.',
  createModificationSchema.shape,
  async (input) => createModification(createModificationSchema.parse(input)),
);

server.tool(
  'set_prices',
  "Set or update prices for a product/modification. Specify price_type_code (e.g., 'retail', 'wholesale').",
  setPricesSchema.shape,
  async (input) => setPrices(setPricesSchema.parse(input)),
);

server.tool(
  'set_property_value',
  'Set a property value for a product or modification. Use property_slug to identify the property.',
  setPropertyValueSchema.shape,
  async (input) => setPropertyValue(setPropertyValueSchema.parse(input)),
);

// ==========================================
// Seed Tools
// ==========================================

server.tool(
  'seed_inverters',
  "Seed the database with 10 inverter products (from svitlovtemryavi.com.ua reference). Creates section 'Інвертори', 6 properties (power, voltage, brand, type, MPPT, PV voltage), and 10 products with prices, stock, and property values. Use dry_run=true to preview.",
  seedInvertersSchema.shape,
  async (input) => seedInverters(seedInvertersSchema.parse(input)),
);

server.tool(
  'seed_from_json',
  'Seed a complete section with properties and products from a JSON structure. Useful for bulk content loading from any source.',
  seedFromJsonSchema.shape,
  async (input) => seedFromJson(seedFromJsonSchema.parse(input)),
);

// ==========================================
// Scraper Tools
// ==========================================

server.tool(
  'scrape_url',
  'Завантажити та проаналізувати будь-яку веб-сторінку. Повертає структуровані дані: заголовок, зображення, посилання, ціни, таблиці характеристик. Режими: text, html, links, images, structured.',
  scrapeUrlSchema.shape,
  async (input) => scrapeUrl(scrapeUrlSchema.parse(input)),
);

server.tool(
  'scrape_product_list',
  'Спарсити список товарів зі сторінки каталогу. Вкажіть CSS-селектори для контейнера товару, назви, ціни, зображення, посилання.',
  scrapeProductListSchema.shape,
  async (input) => scrapeProductList(scrapeProductListSchema.parse(input)),
);

server.tool(
  'scrape_product_page',
  'Спарсити детальну сторінку товару. Автоматично визначає назву, ціну, опис, зображення, характеристики. Можна задати CSS-селектори вручну для точності.',
  scrapeProductPageSchema.shape,
  async (input) => scrapeProductPage(scrapeProductPageSchema.parse(input)),
);

// ==========================================
// Start server
// ==========================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SimplyCMS Content Loader MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
