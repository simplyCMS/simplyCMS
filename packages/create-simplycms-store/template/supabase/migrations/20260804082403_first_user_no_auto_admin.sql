-- Прибирає авто-призначення admin першому зареєстрованому користувачу
-- (жива діра «хто перший встиг», Codex-аудит 2026-08-04): роль admin
-- відтепер призначає ЛИШЕ owner-invite (service_role) або наявний адмін.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_category_id UUID;
BEGIN
    SELECT id INTO default_category_id FROM public.user_categories WHERE is_default = true LIMIT 1;

    INSERT INTO public.profiles (user_id, email, first_name, last_name, category_id)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name',
        default_category_id
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::app_role);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
