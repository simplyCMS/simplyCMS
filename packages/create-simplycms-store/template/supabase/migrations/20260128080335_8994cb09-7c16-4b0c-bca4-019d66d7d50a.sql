-- Add database input validation constraints

-- Price validation (products table)
ALTER TABLE public.products ADD CONSTRAINT products_positive_price 
  CHECK (price IS NULL OR price >= 0);

-- Price validation (product_modifications)
ALTER TABLE public.product_modifications ADD CONSTRAINT modifications_positive_price 
  CHECK (price >= 0);

-- Price validation (services)
ALTER TABLE public.services ADD CONSTRAINT services_positive_price 
  CHECK (price IS NULL OR price >= 0);

-- Quantity validation
ALTER TABLE public.order_items ADD CONSTRAINT order_items_positive_quantity 
  CHECK (quantity > 0);

-- Order totals validation
ALTER TABLE public.orders ADD CONSTRAINT orders_positive_totals 
  CHECK (subtotal >= 0 AND total >= 0);

-- Text length limits (reasonable for user input)
ALTER TABLE public.orders ADD CONSTRAINT orders_notes_length 
  CHECK (char_length(notes) <= 5000 OR notes IS NULL);
  
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_message_length 
  CHECK (char_length(message) <= 10000 OR message IS NULL);

-- Name length validation
ALTER TABLE public.profiles ADD CONSTRAINT profiles_name_length 
  CHECK (
    (char_length(first_name) <= 100 OR first_name IS NULL) AND
    (char_length(last_name) <= 100 OR last_name IS NULL)
  );

-- Order name length validation  
ALTER TABLE public.orders ADD CONSTRAINT orders_name_length
  CHECK (
    char_length(first_name) <= 100 AND
    char_length(last_name) <= 100
  );