-- 0004_functions.sql — функції й тригери над таблицями (Е6г-20).
--
-- Іде ПІСЛЯ `0003_seed` і не генерується drizzle-kit: той не емітить ні
-- функцій, ні тригерів. `0001_init.sql` лишається чистим генератом, а ручні
-- функції/тригери живуть лише в ручних файлах канону (як `0000_prelude`).
--
-- Ідемпотентність — обовʼязкова (`CREATE OR REPLACE`): файл котиться і на чисту
-- БД, і повторно (докат канону в магазині, що вже стартував).

-- Е6г-14: бан тримає БД. Хук Better Auth `session.create.before` (Е6г-13)
-- дає клієнтові чистий код BANNED у звичайному випадку, але BA виконує кожен
-- запит окремою транзакцією: між читанням хука і вставкою сесії бан міг
-- закомітитись. Тригер закриває це вікно.
--
-- `FOR SHARE` береться БЕЗУМОВНО за `id` (умови на `banned_at` у WHERE немає
-- навмисно): у READ COMMITTED рядок, що ще не пройшов фільтр за старою версією
-- (`banned_at IS NULL`), після комміту конкурента не блокувався б. Значення
-- перевіряється ПІСЛЯ читання. Обидва порядки гонки коректні: бан, що ще не
-- закомітився, змушує вставку чекати і побачити `banned_at`; вставка, що ще не
-- закомітилась, змушує `UPDATE users` чекати, а наступний `DELETE FROM
-- sessions` бану вже бачить її.
--
-- Без `SECURITY DEFINER`: proxy пише під `app_admin`, якому `FOR SHARE`
-- дозволяє грант `UPDATE` на `users`. У гонці клієнт отримує ЗАГАЛЬНУ помилку
-- створення сесії, а не BANNED — це прийнятно, бо вікно мікроскопічне.
CREATE OR REPLACE FUNCTION public.refuse_banned_session() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v timestamp with time zone;
BEGIN
  SELECT banned_at INTO v FROM public.users WHERE id = NEW.user_id FOR SHARE;
  IF v IS NOT NULL THEN
    RAISE EXCEPTION 'user % is banned', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Тригерній функції EXECUTE не потрібен (тригер викликає її сам), а дефолтний
-- грант у PUBLIC гейт грантів забороняє.
REVOKE ALL ON FUNCTION public.refuse_banned_session() FROM PUBLIC;

CREATE OR REPLACE TRIGGER sessions_refuse_banned BEFORE INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.refuse_banned_session();
