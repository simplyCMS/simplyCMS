-- Оновлений trigger: зберігає first_name/last_name з metadata та робить першого користувача адміном
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_category_id UUID;
    user_count INTEGER;
    user_role app_role;
BEGIN
    -- Отримати категорію за замовчуванням
    SELECT id INTO default_category_id FROM public.user_categories WHERE is_default = true LIMIT 1;
    
    -- Створити профіль з first_name/last_name з raw_user_meta_data
    INSERT INTO public.profiles (user_id, email, first_name, last_name, category_id)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name',
        default_category_id
    );
    
    -- Перший користувач системи стає адміном, всі решта — звичайні користувачі
    SELECT COUNT(*) INTO user_count FROM auth.users;
    IF user_count <= 1 THEN
        user_role := 'admin'::app_role;
    ELSE
        user_role := 'user'::app_role;
    END IF;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
