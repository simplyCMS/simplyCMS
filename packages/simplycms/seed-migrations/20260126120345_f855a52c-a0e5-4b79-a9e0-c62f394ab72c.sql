-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create enum for property types
CREATE TYPE public.property_type AS ENUM ('text', 'number', 'select', 'multiselect', 'range', 'color', 'boolean');

-- Languages table
CREATE TABLE public.languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (security: separate from profiles)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- User categories (retail, wholesale, dealer)
CREATE TABLE public.user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    price_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    category_id UUID REFERENCES public.user_categories(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order statuses directory
CREATE TABLE public.order_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#6B7280',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Catalog sections
CREATE TABLE public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES public.sections(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Section properties configuration
CREATE TABLE public.section_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code VARCHAR(100) NOT NULL,
    property_type property_type NOT NULL DEFAULT 'text',
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_filterable BOOLEAN NOT NULL DEFAULT false,
    has_page BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    options JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (section_id, code)
);

-- Products
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_description TEXT,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product modifications (variants)
CREATE TABLE public.product_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sku VARCHAR(100),
    price DECIMAL(12,2) NOT NULL,
    old_price DECIMAL(12,2),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_in_stock BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    images JSONB DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product property values
CREATE TABLE public.product_property_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    property_id UUID REFERENCES public.section_properties(id) ON DELETE CASCADE NOT NULL,
    value TEXT,
    numeric_value DECIMAL(15,4),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (product_id, property_id)
);

-- Property pages (for manufacturers, materials, etc.)
CREATE TABLE public.property_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.section_properties(id) ON DELETE CASCADE NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    meta_title TEXT,
    meta_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Services
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Service requests
CREATE TABLE public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES public.services(id),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    status_id UUID REFERENCES public.order_statuses(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    delivery_address TEXT,
    delivery_city TEXT,
    delivery_method TEXT,
    payment_method TEXT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id),
    modification_id UUID REFERENCES public.product_modifications(id),
    service_id UUID REFERENCES public.services(id),
    name TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Wishlists
CREATE TABLE public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

-- Comparisons
CREATE TABLE public.comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

-- Enable RLS on all tables
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_property_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_modifications_updated_at BEFORE UPDATE ON public.product_modifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_property_pages_updated_at BEFORE UPDATE ON public.property_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_category_id UUID;
BEGIN
    SELECT id INTO default_category_id FROM public.user_categories WHERE is_default = true LIMIT 1;
    
    INSERT INTO public.profiles (user_id, email, category_id)
    VALUES (NEW.id, NEW.email, default_category_id);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Languages: public read, admin write
CREATE POLICY "Languages are viewable by everyone" ON public.languages FOR SELECT USING (true);
CREATE POLICY "Admins can manage languages" ON public.languages FOR ALL USING (public.is_admin());

-- User roles: users see own, admin sees all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin());

-- User categories: public read, admin write
CREATE POLICY "Categories are viewable by everyone" ON public.user_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.user_categories FOR ALL USING (public.is_admin());

-- Profiles: users own, admin all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Order statuses: public read, admin write
CREATE POLICY "Order statuses are viewable by everyone" ON public.order_statuses FOR SELECT USING (true);
CREATE POLICY "Admins can manage order statuses" ON public.order_statuses FOR ALL USING (public.is_admin());

-- Sections: public read active, admin all
CREATE POLICY "Active sections are viewable by everyone" ON public.sections FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins can manage sections" ON public.sections FOR ALL USING (public.is_admin());

-- Section properties: public read, admin write
CREATE POLICY "Section properties are viewable by everyone" ON public.section_properties FOR SELECT USING (true);
CREATE POLICY "Admins can manage section properties" ON public.section_properties FOR ALL USING (public.is_admin());

-- Products: public read active, admin all
CREATE POLICY "Active products are viewable by everyone" ON public.products FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.is_admin());

-- Product modifications: public read, admin write
CREATE POLICY "Modifications are viewable by everyone" ON public.product_modifications FOR SELECT USING (true);
CREATE POLICY "Admins can manage modifications" ON public.product_modifications FOR ALL USING (public.is_admin());

-- Product property values: public read, admin write
CREATE POLICY "Property values are viewable by everyone" ON public.product_property_values FOR SELECT USING (true);
CREATE POLICY "Admins can manage property values" ON public.product_property_values FOR ALL USING (public.is_admin());

-- Property pages: public read, admin write
CREATE POLICY "Property pages are viewable by everyone" ON public.property_pages FOR SELECT USING (true);
CREATE POLICY "Admins can manage property pages" ON public.property_pages FOR ALL USING (public.is_admin());

-- Services: public read active, admin all
CREATE POLICY "Active services are viewable by everyone" ON public.services FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins can manage services" ON public.services FOR ALL USING (public.is_admin());

-- Service requests: users own, admin all
CREATE POLICY "Users can view own service requests" ON public.service_requests FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Anyone can create service requests" ON public.service_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage service requests" ON public.service_requests FOR ALL USING (public.is_admin());

-- Orders: users own, admin all
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL USING (public.is_admin());

-- Order items: users view with order, admin all
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Users can create order items" ON public.order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR orders.user_id IS NULL))
);
CREATE POLICY "Admins can manage order items" ON public.order_items FOR ALL USING (public.is_admin());

-- Wishlists: users own
CREATE POLICY "Users can view own wishlist" ON public.wishlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own wishlist" ON public.wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete from wishlist" ON public.wishlists FOR DELETE USING (auth.uid() = user_id);

-- Comparisons: users own
CREATE POLICY "Users can view own comparisons" ON public.comparisons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own comparisons" ON public.comparisons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete from comparisons" ON public.comparisons FOR DELETE USING (auth.uid() = user_id);

-- Insert default data
INSERT INTO public.languages (code, name, is_default) VALUES ('uk', 'Українська', true);

INSERT INTO public.user_categories (name, code, price_multiplier, is_default) VALUES 
    ('Роздріб', 'retail', 1.00, true),
    ('Оптовий', 'wholesale', 0.90, false),
    ('Дилер', 'dealer', 0.80, false);

INSERT INTO public.order_statuses (name, code, color, sort_order, is_default) VALUES 
    ('Новий', 'new', '#3B82F6', 0, true),
    ('Підтверджено', 'confirmed', '#10B981', 1, false),
    ('В обробці', 'processing', '#F59E0B', 2, false),
    ('Відправлено', 'shipped', '#8B5CF6', 3, false),
    ('Доставлено', 'delivered', '#22C55E', 4, false),
    ('Скасовано', 'cancelled', '#EF4444', 5, false);