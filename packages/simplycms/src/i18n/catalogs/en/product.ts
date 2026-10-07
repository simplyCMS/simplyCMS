import type { Catalog } from '../../types';

/** Картка товару — дзеркало `uk/product.ts`. */
export const messages: Catalog = {
  'product.notFound': 'Product not found',
  'product.goBack': 'Go back',
  'product.sku': 'SKU: {sku}',
  'product.metaDescription': 'Buy {name}',

  'product.inStock': 'In stock',
  'product.onOrder': 'Made to order',
  'product.outOfStock': 'Out of stock',
  'product.availability': 'Availability',
  'product.availabilityInStores': 'Availability in stores',
  'product.inStockCount': 'In stock: {count} pcs',
  'product.unitsCount': '{count} pcs',

  'product.addToCart': 'Add to cart',
  'product.addedToCart': 'Added to cart',

  // Порогові підказки знижок (Е6в-12) — дзеркало `uk/product.ts`.
  'product.discountHint.quantity': 'from {threshold} pcs — {price}/pc',
  'product.discountHint.cartTotal': 'from {amount} in cart — {price}/pc',
  'product.discountHint.percent': ' (−{percent}%)',

  'product.description': 'Description',
  'product.noDescription': 'No description available',
  'product.characteristics': 'Specifications',
  'product.reviews': 'Reviews',
  'product.modification': 'Variant',

  'product.review.notAuthorized': 'Not signed in',
  'product.review.submitted': 'Review submitted',
  'product.review.submittedDescription': 'It will appear after moderation',
  'product.review.deleted': 'Review deleted',
};
