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

-- ── shipping_zones: «≥1 основна зона» ───────────────────────────────────────
-- «Не більше однієї» стереже частковий унікальний індекс, «основна активна» —
-- CHECK. «Принаймні одна» рядковим обмеженням не виразити: перевіряємо після
-- транзакції. 🔴 Відкладений (DEFERRED) обовʼязково: заміна основної — це два
-- UPDATE в одній транзакції (зняти, поставити), між якими основної немає.
-- Видалення й зняття прапорця поодинці відхиляються на COMMIT. TRUNCATE
-- рядкові тригери не викликає — так тести чистять таблицю.
CREATE OR REPLACE FUNCTION public.require_default_shipping_zone() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shipping_zones WHERE is_default) THEN
    RAISE EXCEPTION 'shipping_zones: потрібна рівно одна основна зона'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.require_default_shipping_zone() FROM PUBLIC;

-- `CREATE OR REPLACE` для constraint-тригерів Postgres не підтримує —
-- ідемпотентність через DROP.
DROP TRIGGER IF EXISTS shipping_zones_require_default ON public.shipping_zones;
CREATE CONSTRAINT TRIGGER shipping_zones_require_default
AFTER INSERT OR UPDATE OF is_default OR DELETE ON public.shipping_zones
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.require_default_shipping_zone();

-- ── languages: машина станів мови (М1, І1–І3) ───────────────────────────────
-- «Рівно одна основна» тримає частковий унікальний індекс, «основна лише
-- `published`» на INSERT — CHECK `languages_default_published`. Рядкові
-- обмеження не бачать СТАРОГО рядка, тому незмінність `code` і `is_default`,
-- перехід основної в не-`published` та видалення основної — тригер.
-- BEFORE-тригер спрацьовує раніше за CHECK, тож на UPDATE користувач бачить
-- пояснення, а не безіменний 23514. Не-основну мову (без посилань на неї)
-- видалити можна: будь-яке посилання блокує FK RESTRICT, а не цей тригер.
-- INSERT тригер не чіпає: мову створює операція з мовним набором під замком.
-- TRUNCATE рядкові тригери не викликає — так тести чистять таблицю.
CREATE OR REPLACE FUNCTION public.languages_guard() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_default THEN
      RAISE EXCEPTION 'languages: основну мову не видалити'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.is_default IS DISTINCT FROM OLD.is_default
     OR (NEW.is_default AND NEW.status <> 'published') THEN
    RAISE EXCEPTION 'languages: код і основна мова незмінні'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.languages_guard() FROM PUBLIC;

DROP TRIGGER IF EXISTS languages_guard ON public.languages;
CREATE TRIGGER languages_guard
BEFORE UPDATE OR DELETE ON public.languages
FOR EACH ROW EXECUTE FUNCTION public.languages_guard();

-- ── advisory-замок поточного бекенда: ОДНА функція для всіх тригерів замка ────
-- Ключ береться тим самим виразом, що й TS (`advisoryXactLock`):
-- `hashtextextended(<ключ>, 0)`. Для 64-бітного ключа Postgres кладе в
-- `pg_locks` старшу половину в `classid`, молодшу в `objid`, `objsubid = 1`.
-- `mode`: ексклюзивний замок — `ExclusiveLock`, спільний — `ShareLock`.
-- Окрема функція, а не копія виразу в кожному тригері: розрахунок ключа не має
-- розходитись між правилами (SC001 і SC004). Парність літерала з
-- `LOCK_KEYS.languagesSet` доводить `languages-lock.test.ts`.
-- Без `SECURITY DEFINER`: `pg_locks` показує власні замки кожному, EXECUTE видано
-- ролям застосунку нижче (0002 відкликає його в PUBLIC для нових функцій).
CREATE OR REPLACE FUNCTION public.advisory_lock_held(lock_key text, lock_modes text[]) RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_locks l
     WHERE l.locktype = 'advisory'
       AND l.pid = pg_backend_pid()
       AND l.mode = ANY (lock_modes)
       AND l.granted
       AND l.database = (SELECT d.oid FROM pg_catalog.pg_database d
                          WHERE d.datname = current_database())
       AND l.objsubid = 1
       AND ((l.classid::bigint << 32) | l.objid::bigint)
           = hashtextextended(lock_key, 0)
  );
$$;

REVOKE ALL ON FUNCTION public.advisory_lock_held(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advisory_lock_held(text, text[]) TO app_runtime, app_user, app_admin;

-- ── languages: запис лише під ексклюзивним замком `languages-set` (М1, І16) ──
-- Правило: КОЖЕН запис у `languages` (INSERT, UPDATE, DELETE) береться під
-- ексклюзивним advisory-замком `languages-set` — його творці адрес і токенів
-- беруть спільним, тож зміна набору мов (додавання, статус, видалення) чекає їх
-- і не ламає їхній коміт відкладеною перевіркою наявності адреси. Тригер
-- тримає правило в БД, а не лише в коді операцій: пряма вставка мимо замка
-- відмовляє окремим SQLSTATE `SC001`.
CREATE OR REPLACE FUNCTION public.languages_require_lock() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog AS $$
BEGIN
  IF NOT public.advisory_lock_held('languages-set', ARRAY['ExclusiveLock']) THEN
    RAISE EXCEPTION 'languages: запис без ексклюзивного замка languages-set'
      USING ERRCODE = 'SC001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.languages_require_lock() FROM PUBLIC;

DROP TRIGGER IF EXISTS languages_require_lock ON public.languages;
CREATE TRIGGER languages_require_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.languages
FOR EACH ROW EXECUTE FUNCTION public.languages_require_lock();

-- ── реєстри адрес і токенів: запис лише під замком `languages-set` (СПІЛЬНИМ або
-- ексклюзивним), SQLSTATE `SC004` ──────────────────────────────────────────────
-- Дзеркало SC001 для творців адрес (М1, майстер §3.5): створення сутності, нова
-- модифікація, явна зміна адреси чи токена й пакетне заповнення мови беруть
-- спільний замок, а зміна набору мов — ексклюзивний. Без замка творець міг би
-- вставити адресу, не бачачи мови, що додається паралельно. Рівень STATEMENT: замок
-- один на оператор, перевірка не множиться на рядки. DELETE не охоплено свідомо:
-- каскад видалення товару й мови йде через RI, а видалення поточної адреси без
-- заміни ловить тригер реєстру (`require_current_address|token`).
CREATE OR REPLACE FUNCTION public.addresses_require_languages_lock() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog AS $$
BEGIN
  IF NOT public.advisory_lock_held('languages-set', ARRAY['ExclusiveLock', 'ShareLock']) THEN
    RAISE EXCEPTION '%: запис без замка languages-set', TG_TABLE_NAME
      USING ERRCODE = 'SC004';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.addresses_require_languages_lock() FROM PUBLIC;

DROP TRIGGER IF EXISTS url_paths_require_lock ON public.url_paths;
CREATE TRIGGER url_paths_require_lock
BEFORE INSERT OR UPDATE ON public.url_paths
FOR EACH STATEMENT EXECUTE FUNCTION public.addresses_require_languages_lock();

DROP TRIGGER IF EXISTS slug_tokens_require_lock ON public.slug_tokens;
CREATE TRIGGER slug_tokens_require_lock
BEFORE INSERT OR UPDATE ON public.slug_tokens
FOR EACH STATEMENT EXECUTE FUNCTION public.addresses_require_languages_lock();

-- ── сервісні облікові записи ≠ облікові дані входу (М1, І27) ─────────────────
-- Сервісний запис (рядок `service_accounts`) не має рядка `accounts`: увійти
-- паролем чи OAuth він не може. Інваріант двосторонній і діє на INSERT та на
-- UPDATE `user_id` (`app_admin` має UPDATE на обидві таблиці): тригер на `accounts`
-- (відмова SC002, коли `user_id` — сервісний) і дзеркальний на
-- `service_accounts` (відмова SC003, коли в користувача вже є `accounts`).
-- Рядок `users` блокується `FOR NO KEY UPDATE` в обох (конфліктує сам із собою, але не з
-- FK-вставками `sessions`/`user_roles`/`orders`, що беруть `KEY SHARE`): інакше дві конкурентні вставки
-- (кожна не бачить незакомічену іншу) пройшли б обидві.
-- Без `SECURITY DEFINER`: Better Auth пише `accounts` під `app_admin`, якому
-- видано CRUD на `service_accounts` (0002_grants), тож читання тригером працює
-- з правами актора.
CREATE OR REPLACE FUNCTION public.accounts_refuse_service() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR NO KEY UPDATE;
  IF EXISTS (SELECT 1 FROM public.service_accounts WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'accounts: сервісний обліковий запис не має облікових даних входу'
      USING ERRCODE = 'SC002';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.accounts_refuse_service() FROM PUBLIC;

DROP TRIGGER IF EXISTS accounts_refuse_service ON public.accounts;
CREATE TRIGGER accounts_refuse_service
BEFORE INSERT OR UPDATE OF user_id ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.accounts_refuse_service();

CREATE OR REPLACE FUNCTION public.service_accounts_refuse_human() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id = NEW.user_id FOR NO KEY UPDATE;
  IF EXISTS (SELECT 1 FROM public.accounts WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'service_accounts: у користувача вже є облікові дані входу'
      USING ERRCODE = 'SC003';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.service_accounts_refuse_human() FROM PUBLIC;

DROP TRIGGER IF EXISTS service_accounts_refuse_human ON public.service_accounts;
CREATE TRIGGER service_accounts_refuse_human
BEFORE INSERT OR UPDATE OF user_id ON public.service_accounts
FOR EACH ROW EXECUTE FUNCTION public.service_accounts_refuse_human();

-- ── перекладні сутності: обовʼязковий рядок основної мови (М1, І4–І5) ────────
-- ОДНА функція на всі перекладні пари (товар, розділ, банер, плагінні таблиці
-- `plg_*_translations`): тригер на кожну пару окремо розходився б у деталях
-- (що вважати порожнім, як обробити каскад) і не виявляв би цього тестами.
-- Конструктор пари — процедура `attach_source_translation_triggers` нижче.
--
-- `TG_ARGV`: [0] роль виклику `base` | `translation`; [1] базова таблиця;
-- [2] таблиця перекладів; [3] FK-колонка в перекладах; [4] обовʼязкові колонки
-- через кому; [5] необовʼязкова умова на базовому рядку `колонка=значення`
-- (текстове порівняння; І5: значення властивості вимагає тексту лише для
-- `value_kind=text`).
--
-- Відкладений (DEFERRED), бо сутність і її переклад вставляють двома
-- стейтментами однієї транзакції, а заміна рядка основної мови — UPDATE-ом
-- між якими інваріант тимчасово порушений. База, якої на COMMIT уже немає
-- (каскадне видалення, вставка й видалення в одній транзакції), перекладу не
-- вимагає. Порожнє = `nullif(btrim(col), '') IS NULL` (К3): операція
-- нормалізує першою, тригер — страховка для прямого SQL.
--
-- Ідентифікатори — лише через `format('%I')` (у `TG_ARGV` вони СИРІ, без
-- лапок: `probe_q"x` не ламає SQL), значення — лише параметрами `USING`.
--
-- Без `SECURITY DEFINER` (як усі функції канону, гейт `grants-parity`):
-- функція читає `languages`, базу й переклади з правами того, хто пише
-- (відкладений тригер на COMMIT ще працює під `SET LOCAL ROLE` актора; доказ —
-- кейс «права актора» в `source-translation-required.test.ts`).
-- 🔴 Конвенція для кожної пари, у т.ч. для плагінного хелпера М2: таблиці під
-- цим тригером не мають RLS, що ховає рядки від ролі-писаря. Перекладні
-- таблиці ядра і `languages` RLS не мають зовсім. Інакше RLS, який ховає
-- БАЗОВИЙ рядок, дав би не відмову, а ТИХИЙ ПРОПУСК (гілка «бази немає»), а
-- RLS, який ховає рядок ПЕРЕКЛАДУ, — хибну відмову.
CREATE OR REPLACE FUNCTION public.require_source_translation() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_role     text   := TG_ARGV[0];
  v_base     text   := TG_ARGV[1];
  v_trans    text   := TG_ARGV[2];
  v_fk       text   := TG_ARGV[3];
  v_required text[] := string_to_array(TG_ARGV[4], ',');
  v_cond_pos int    := position('=' IN coalesce(TG_ARGV[5], ''));
  v_cond_col text;
  v_cond_val text;
  v_ids      uuid[];
  v_old      uuid;
  v_new      uuid;
  v_id       uuid;
  v_applies  boolean;
  v_primary  text;
  v_filled   text;
  v_ok       boolean;
BEGIN
  IF coalesce(v_role, '') NOT IN ('base', 'translation')
     OR coalesce(v_base, '') = '' OR coalesce(v_trans, '') = ''
     OR coalesce(v_fk, '') = '' OR coalesce(TG_ARGV[4], '') = '' THEN
    RAISE EXCEPTION 'require_source_translation: невідомі аргументи тригера (роль=%, база=%, переклади=%, обовʼязкові=%)',
      v_role, v_base, v_trans, TG_ARGV[4]
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_cond_pos > 0 THEN
    v_cond_col := left(TG_ARGV[5], v_cond_pos - 1);
    v_cond_val := substr(TG_ARGV[5], v_cond_pos + 1);
  END IF;

  -- Яку сутність (чи дві, якщо переклад перенесли на іншу) перевіряти.
  IF v_role = 'base' THEN
    v_ids := ARRAY[NEW.id];
  ELSE
    IF TG_OP <> 'INSERT' THEN
      EXECUTE format('SELECT ($1).%I', v_fk) INTO v_old USING OLD;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      EXECUTE format('SELECT ($1).%I', v_fk) INTO v_new USING NEW;
    END IF;
    v_ids := ARRAY[v_old, v_new];
  END IF;

  SELECT string_agg(format('nullif(btrim(%I), %L) IS NOT NULL', c, ''), ' AND ')
    INTO v_filled
    FROM unnest(v_required) AS c;

  FOR v_id IN SELECT DISTINCT x FROM unnest(v_ids) AS x WHERE x IS NOT NULL LOOP
    -- Бази вже немає або умова не виконується — перекладу не вимагаємо
    -- (INTO без рядків дає NULL).
    IF v_cond_col IS NULL THEN
      EXECUTE format('SELECT true FROM public.%I WHERE id = $1', v_base)
        INTO v_applies USING v_id;
    ELSE
      EXECUTE format('SELECT %I::text = $2 FROM public.%I WHERE id = $1',
                     v_cond_col, v_base)
        INTO v_applies USING v_id, v_cond_val;
    END IF;
    CONTINUE WHEN v_applies IS NOT TRUE;

    IF v_primary IS NULL THEN
      SELECT code INTO v_primary FROM public.languages WHERE is_default;
      IF NOT FOUND THEN
        RAISE EXCEPTION '%: немає основної мови, переклад неможливий', v_base
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND locale = $2 AND %s)',
      v_trans, v_fk, v_filled)
      INTO v_ok USING v_id, v_primary;
    IF NOT v_ok THEN
      RAISE EXCEPTION '%: потрібен переклад основною мовою (%)',
        v_base, array_to_string(v_required, ', ')
        USING ERRCODE = 'check_violation',
              DETAIL = format('id = %s, мова = %s', v_id, v_primary);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.require_source_translation() FROM PUBLIC;

-- Підключення пари: обидва `CREATE CONSTRAINT TRIGGER` будуються з ОДНИХ
-- аргументів, тож перелік `UPDATE OF` і `TG_ARGV[4]` не можуть розійтися.
-- Кличуть міграції ядра, probe-хелпер тестів і (М2) плагінний хелпер; EXECUTE
-- ролям застосунку не потрібен — це DDL власника міграцій.
--
-- Тригер на базі: `AFTER INSERT` — рядок перекладу основною мовою обовʼязковий
-- із першого коміту сутності; коли задано умову, ще й `UPDATE OF <колонка
-- умови>` — інакше UPDATE, що робить умову істинною, мовчки порушив би І4/І5.
-- На перекладах — `DELETE` і `UPDATE OF` обовʼязкових колонок, `locale` та FK
-- (зміна будь-якої з них може прибрати рядок основної мови зі сутності).
--
-- Припущення функції перевіряються тут, а не падають у рантаймі на COMMIT:
-- база має `id uuid`; FK-колонка — `uuid` і входить до зовнішнього ключа на
-- `base(id)` (одноколонкового чи складеного, як `(product_id, id)`);
-- обовʼязкові колонки текстові (`btrim` не приймає інших). Усі помилки —
-- `invalid_parameter_value` і називають колонку, а не "column does not exist"
-- з глибини DDL.
--
-- Імена тригерів `<таблиця>_src_base` / `<таблиця>_src_tr`: довге імʼя
-- таблиці (`modification_property_value_translations`) з довшим суфіксом
-- перевищило б 63 байти, тож імʼя таблиці обрізається детерміновано.
-- Ідемпотентно: constraint-тригер не має `CREATE OR REPLACE`, тож DROP + CREATE.
CREATE OR REPLACE PROCEDURE public.attach_source_translation_triggers(
  base regclass,
  translations regclass,
  fk text,
  required text[],
  condition text DEFAULT NULL
)
LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_base       text;
  v_trans      text;
  v_col        text;
  v_cond_col   text;
  v_cond_pos   int;
  v_id_att     smallint;
  v_fk_att     smallint;
  v_update_of  text;
  v_tail       text;
  v_base_evt   text := 'INSERT';
  v_base_trg   text;
  v_trans_trg  text;
BEGIN
  SELECT c.relname INTO v_base FROM pg_class c
   WHERE c.oid = base AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;
  SELECT c.relname INTO v_trans FROM pg_class c
   WHERE c.oid = translations AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;
  IF v_base IS NULL OR v_trans IS NULL THEN
    RAISE EXCEPTION 'attach_source_translation_triggers: % і % мають бути звичайними таблицями схеми public',
      base, translations USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF required IS NULL OR cardinality(required) = 0 THEN
    RAISE EXCEPTION 'attach_source_translation_triggers: потрібна хоча б одна обовʼязкова колонка'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  FOREACH v_col IN ARRAY required || ARRAY[fk, 'locale'] LOOP
    IF v_col IS NULL OR position(',' IN v_col) > 0 THEN
      RAISE EXCEPTION 'attach_source_translation_triggers: хибна назва колонки "%" (порожня чи з комою)', v_col
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = translations AND a.attname = v_col
                      AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'attach_source_translation_triggers: у %.% немає колонки "%"',
        'public', v_trans, v_col USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  FOREACH v_col IN ARRAY required LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = translations AND a.attname = v_col
                      AND a.atttypid IN ('text'::regtype, 'varchar'::regtype)) THEN
      RAISE EXCEPTION 'attach_source_translation_triggers: обовʼязкова колонка "%" у %.% має бути text або varchar',
        v_col, 'public', v_trans USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  SELECT a.attnum INTO v_id_att FROM pg_attribute a
   WHERE a.attrelid = base AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_id_att IS NULL THEN
    RAISE EXCEPTION 'attach_source_translation_triggers: у %.% немає колонки id типу uuid',
      'public', v_base USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT a.attnum INTO v_fk_att FROM pg_attribute a
   WHERE a.attrelid = translations AND a.attname = fk AND a.atttypid = 'uuid'::regtype
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_fk_att IS NULL THEN
    RAISE EXCEPTION 'attach_source_translation_triggers: колонка "%" у %.% має бути типу uuid',
      fk, 'public', v_trans USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k,
                              unnest(k.conkey, k.confkey) AS u(src, dst)
                  WHERE k.contype = 'f' AND k.conrelid = translations
                    AND k.confrelid = base AND u.src = v_fk_att AND u.dst = v_id_att) THEN
    RAISE EXCEPTION 'attach_source_translation_triggers: колонка "%" у %.% має бути зовнішнім ключем на %.%(id)',
      fk, 'public', v_trans, 'public', v_base USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_tail := format('%L, %L, %L, %L', v_base, v_trans, fk, array_to_string(required, ','));
  IF coalesce(condition, '') <> '' THEN
    v_cond_pos := position('=' IN condition);
    IF v_cond_pos < 2 OR v_cond_pos = length(condition) THEN
      RAISE EXCEPTION 'attach_source_translation_triggers: умова має вигляд col=value, отримано "%"', condition
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_cond_col := left(condition, v_cond_pos - 1);
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = base AND a.attname = v_cond_col
                      AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'attach_source_translation_triggers: у %.% немає колонки умови "%"',
        'public', v_base, v_cond_col USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_tail := v_tail || format(', %L', condition);
    v_base_evt := format('INSERT OR UPDATE OF %I', v_cond_col);
  END IF;

  -- Перелік `UPDATE OF` без дублів і в стабільному порядку: обовʼязкові,
  -- `locale`, FK.
  SELECT string_agg(format('%I', c), ', ' ORDER BY first_pos) INTO v_update_of
    FROM (SELECT c, min(pos) AS first_pos
            FROM unnest(required || ARRAY['locale', fk]) WITH ORDINALITY AS u(c, pos)
           GROUP BY c) cols;

  v_base_trg  := left(v_base, 63 - length('_src_base')) || '_src_base';
  v_trans_trg := left(v_trans, 63 - length('_src_tr')) || '_src_tr';

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_base_trg, v_base);
  EXECUTE format(
    'CREATE CONSTRAINT TRIGGER %I AFTER %s ON public.%I '
    || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
    || 'EXECUTE FUNCTION public.require_source_translation(%L, %s)',
    v_base_trg, v_base_evt, v_base, 'base', v_tail);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trans_trg, v_trans);
  EXECUTE format(
    'CREATE CONSTRAINT TRIGGER %I AFTER DELETE OR UPDATE OF %s ON public.%I '
    || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
    || 'EXECUTE FUNCTION public.require_source_translation(%L, %s)',
    v_trans_trg, v_update_of, v_trans, 'translation', v_tail);
END;
$$;

REVOKE ALL ON PROCEDURE public.attach_source_translation_triggers(regclass, regclass, text, text[], text)
  FROM PUBLIC;

-- ── url_paths: рівно одна ПОТОЧНА адреса на (сутність, мова) (М1, І16, К4) ──
-- «Не більше однієї» тримає частковий UNIQUE реєстру, «принаймні одна» — ця
-- відкладена перевірка: заміна поточної адреси (нову вставити, стару в історію)
-- — два стейтменти однієї транзакції, між якими поточної немає.
--
-- `TG_ARGV`: [0] роль `base` | `registry`; [1] базова таблиця; [2] реєстр;
-- [3] FK-колонка реєстру на `base(id)`.
--  • `base` (AFTER INSERT бази): усі мови `draft`/`published` зі знімка своєї
--    транзакції мають поточну адресу. Рядок мови тригер НЕ запускає: повноту
--    нової мови дає звірка перед публікацією.
--  • `registry` (AFTER DELETE / UPDATE реєстру): лише (сутність, ТА мова);
--    першими кроками `CONTINUE`, як «бази немає» в `require_source_translation`:
--    мови вже немає чи вона не draft/published, або сутності вже немає.
-- Ідентифікатори — лише `format('%I')`, значення — `USING`. Без SECURITY DEFINER;
-- реєстр і `languages` не мають RLS (конвенція вище).
CREATE OR REPLACE FUNCTION public.require_current_address() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_role  text := TG_ARGV[0];
  v_base  text := TG_ARGV[1];
  v_reg   text := TG_ARGV[2];
  v_fk    text := TG_ARGV[3];
  v_ents  uuid[];
  v_locs  text[];
  v_i     int;
  v_ent   uuid;
  v_loc   text;
  v_ok    boolean;
BEGIN
  IF coalesce(v_role, '') NOT IN ('base', 'registry')
     OR coalesce(v_base, '') = '' OR coalesce(v_reg, '') = ''
     OR coalesce(v_fk, '') = '' THEN
    RAISE EXCEPTION 'require_current_address: невідомі аргументи тригера (роль=%, база=%, реєстр=%, колонка=%)',
      v_role, v_base, v_reg, v_fk USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_role = 'base' THEN
    -- Сутність, видалена в цій самій транзакції, адреси не вимагає.
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', v_base)
      INTO v_ok USING NEW.id;
    IF NOT v_ok THEN RETURN NULL; END IF;
    FOR v_loc IN
      SELECT l.code FROM public.languages l
       WHERE l.status IN ('draft', 'published') ORDER BY l.code
    LOOP
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND locale = $2 AND is_current)',
        v_reg, v_fk) INTO v_ok USING NEW.id, v_loc;
      IF NOT v_ok THEN
        RAISE EXCEPTION '%: потрібна поточна адреса для кожної мови (draft/published)', v_base
          USING ERRCODE = 'check_violation',
                DETAIL = format('id = %s, мова = %s', NEW.id, v_loc);
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;

  -- Реєстр: пари (сутність, мова) старого й нового рядка. UPDATE, що переніс
  -- рядок в іншу сутність чи мову, може лишити без адреса обидві.
  IF TG_OP <> 'INSERT' THEN
    EXECUTE format('SELECT ($1).%I', v_fk) INTO v_ent USING OLD;
    v_ents := ARRAY[v_ent]; v_locs := ARRAY[OLD.locale];
  END IF;
  IF TG_OP = 'UPDATE' THEN
    EXECUTE format('SELECT ($1).%I', v_fk) INTO v_ent USING NEW;
    v_ents := v_ents || v_ent; v_locs := v_locs || NEW.locale;
  END IF;

  FOR v_i IN 1 .. coalesce(cardinality(v_ents), 0) LOOP
    v_ent := v_ents[v_i]; v_loc := v_locs[v_i];
    CONTINUE WHEN v_ent IS NULL;
    -- Мови вже немає (каскад) або вона не draft/published: disabled
    -- зберігає адреса і нічого не вимагає.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.languages
       WHERE code = v_loc AND status IN ('draft', 'published'));
    -- Сутності вже немає (каскад видалення) — вимагати нічого.
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', v_base)
      INTO v_ok USING v_ent;
    CONTINUE WHEN NOT v_ok;
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND locale = $2 AND is_current)',
      v_reg, v_fk) INTO v_ok USING v_ent, v_loc;
    IF NOT v_ok THEN
      RAISE EXCEPTION '%: потрібна рівно одна поточна адреса (мова %)', v_base, v_loc
        USING ERRCODE = 'check_violation',
              DETAIL = format('id = %s', v_ent);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.require_current_address() FROM PUBLIC;

-- Підключення пари: обидва CONSTRAINT TRIGGER з одних аргументів. Реєстр
-- слухає ще й `locale` та FK: перенесення рядка в іншу мову чи сутність теж
-- може лишити пару без поточної адреса. Ідемпотентно (DROP + CREATE); імена
-- обрізаються до 63 байт детерміновано.
CREATE OR REPLACE PROCEDURE public.attach_current_address_triggers(
  base regclass,
  registry regclass,
  fk text
)
LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_base   text;
  v_reg    text;
  v_id_att smallint;
  v_fk_att smallint;
  v_col    text;
  v_b_trg  text;
  v_r_trg  text;
BEGIN
  SELECT c.relname INTO v_base FROM pg_class c
   WHERE c.oid = base AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;
  SELECT c.relname INTO v_reg FROM pg_class c
   WHERE c.oid = registry AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;
  IF v_base IS NULL OR v_reg IS NULL THEN
    RAISE EXCEPTION 'attach_current_address_triggers: % і % мають бути звичайними таблицями схеми public',
      base, registry USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOREACH v_col IN ARRAY ARRAY[fk, 'locale', 'is_current', 'path'] LOOP
    IF v_col IS NULL OR NOT EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = registry AND a.attname = v_col
            AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'attach_current_address_triggers: у %.% немає колонки "%"', 'public', v_reg, v_col
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  SELECT a.attnum INTO v_id_att FROM pg_attribute a
   WHERE a.attrelid = base AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_id_att IS NULL THEN
    RAISE EXCEPTION 'attach_current_address_triggers: у %.% немає колонки id типу uuid', 'public', v_base
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT a.attnum INTO v_fk_att FROM pg_attribute a
   WHERE a.attrelid = registry AND a.attname = fk AND a.atttypid = 'uuid'::regtype
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_fk_att IS NULL THEN
    RAISE EXCEPTION 'attach_current_address_triggers: колонка "%" у %.% має бути типу uuid', fk, 'public', v_reg
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k,
                              unnest(k.conkey, k.confkey) AS u(src, dst)
                  WHERE k.contype = 'f' AND k.conrelid = registry
                    AND k.confrelid = base AND u.src = v_fk_att AND u.dst = v_id_att) THEN
    RAISE EXCEPTION 'attach_current_address_triggers: колонка "%" у %.% має бути зовнішнім ключем на %.%(id)',
      fk, 'public', v_reg, 'public', v_base USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_b_trg := left(v_base, 63 - length('_cur_addr_b')) || '_cur_addr_b';
  v_r_trg := left(v_reg, 63 - length('_cur_addr_r')) || '_cur_addr_r';

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_b_trg, v_base);
  EXECUTE format(
    'CREATE CONSTRAINT TRIGGER %I AFTER INSERT ON public.%I '
    || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
    || 'EXECUTE FUNCTION public.require_current_address(%L, %L, %L, %L)',
    v_b_trg, v_base, 'base', v_base, v_reg, fk);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_r_trg, v_reg);
  EXECUTE format(
    'CREATE CONSTRAINT TRIGGER %I AFTER DELETE OR UPDATE OF is_current, path, locale, %I ON public.%I '
    || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
    || 'EXECUTE FUNCTION public.require_current_address(%L, %L, %L, %L)',
    v_r_trg, fk, v_reg, 'registry', v_base, v_reg, fk);
END;
$$;

REVOKE ALL ON PROCEDURE public.attach_current_address_triggers(regclass, regclass, text) FROM PUBLIC;

-- ── slug_tokens: рівно один ПОТОЧНИЙ токен на (сутність, мова) (М1, І21, К4) ─
-- Дзеркало `require_current_address()`: ті самі аргументи й гілки, колонка
-- тексту — `slug`. Область токена `(token_kind, scope_id)` уже в ключі
-- унікальності реєстру, а поточний токен шукається за FK сутності, однозначним
-- у своїй області.
CREATE OR REPLACE FUNCTION public.require_current_token() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_role  text := TG_ARGV[0];
  v_base  text := TG_ARGV[1];
  v_reg   text := TG_ARGV[2];
  v_fk    text := TG_ARGV[3];
  v_ents  uuid[];
  v_locs  text[];
  v_i     int;
  v_ent   uuid;
  v_loc   text;
  v_ok    boolean;
BEGIN
  IF coalesce(v_role, '') NOT IN ('base', 'registry')
     OR coalesce(v_base, '') = '' OR coalesce(v_reg, '') = ''
     OR coalesce(v_fk, '') = '' THEN
    RAISE EXCEPTION 'require_current_token: невідомі аргументи тригера (роль=%, база=%, реєстр=%, колонка=%)',
      v_role, v_base, v_reg, v_fk USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_role = 'base' THEN
    -- Сутність, видалена в цій самій транзакції, токена не вимагає.
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', v_base)
      INTO v_ok USING NEW.id;
    IF NOT v_ok THEN RETURN NULL; END IF;
    FOR v_loc IN
      SELECT l.code FROM public.languages l
       WHERE l.status IN ('draft', 'published') ORDER BY l.code
    LOOP
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND locale = $2 AND is_current)',
        v_reg, v_fk) INTO v_ok USING NEW.id, v_loc;
      IF NOT v_ok THEN
        RAISE EXCEPTION '%: потрібна поточна токен для кожної мови (draft/published)', v_base
          USING ERRCODE = 'check_violation',
                DETAIL = format('id = %s, мова = %s', NEW.id, v_loc);
      END IF;
    END LOOP;
    RETURN NULL;
  END IF;

  -- Реєстр: пари (сутність, мова) старого й нового рядка. UPDATE, що переніс
  -- рядок в іншу сутність чи мову, може лишити без токен обидві.
  IF TG_OP <> 'INSERT' THEN
    EXECUTE format('SELECT ($1).%I', v_fk) INTO v_ent USING OLD;
    v_ents := ARRAY[v_ent]; v_locs := ARRAY[OLD.locale];
  END IF;
  IF TG_OP = 'UPDATE' THEN
    EXECUTE format('SELECT ($1).%I', v_fk) INTO v_ent USING NEW;
    v_ents := v_ents || v_ent; v_locs := v_locs || NEW.locale;
  END IF;

  FOR v_i IN 1 .. coalesce(cardinality(v_ents), 0) LOOP
    v_ent := v_ents[v_i]; v_loc := v_locs[v_i];
    CONTINUE WHEN v_ent IS NULL;
    -- Мови вже немає (каскад) або вона не draft/published: disabled
    -- зберігає токен і нічого не вимагає.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM public.languages
       WHERE code = v_loc AND status IN ('draft', 'published'));
    -- Сутності вже немає (каскад видалення) — вимагати нічого.
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1)', v_base)
      INTO v_ok USING v_ent;
    CONTINUE WHEN NOT v_ok;
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1 AND locale = $2 AND is_current)',
      v_reg, v_fk) INTO v_ok USING v_ent, v_loc;
    IF NOT v_ok THEN
      RAISE EXCEPTION '%: потрібна рівно одна поточна токен (мова %)', v_base, v_loc
        USING ERRCODE = 'check_violation',
              DETAIL = format('id = %s', v_ent);
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.require_current_token() FROM PUBLIC;

-- Підключення пари: обидва CONSTRAINT TRIGGER з одних аргументів. Реєстр
-- слухає ще й `locale` та FK: перенесення рядка в іншу мову чи сутність теж
-- може лишити пару без поточної токен. Ідемпотентно (DROP + CREATE); імена
-- обрізаються до 63 байт детерміновано.
CREATE OR REPLACE PROCEDURE public.attach_current_token_triggers(
  base regclass,
  registry regclass,
  fk text
)
LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_base   text;
  v_reg    text;
  v_id_att smallint;
  v_fk_att smallint;
  v_col    text;
  v_b_trg  text;
  v_r_trg  text;
BEGIN
  SELECT c.relname INTO v_base FROM pg_class c
   WHERE c.oid = base AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;
  SELECT c.relname INTO v_reg FROM pg_class c
   WHERE c.oid = registry AND c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;
  IF v_base IS NULL OR v_reg IS NULL THEN
    RAISE EXCEPTION 'attach_current_token_triggers: % і % мають бути звичайними таблицями схеми public',
      base, registry USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOREACH v_col IN ARRAY ARRAY[fk, 'locale', 'is_current', 'slug'] LOOP
    IF v_col IS NULL OR NOT EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = registry AND a.attname = v_col
            AND a.attnum > 0 AND NOT a.attisdropped) THEN
      RAISE EXCEPTION 'attach_current_token_triggers: у %.% немає колонки "%"', 'public', v_reg, v_col
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  SELECT a.attnum INTO v_id_att FROM pg_attribute a
   WHERE a.attrelid = base AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_id_att IS NULL THEN
    RAISE EXCEPTION 'attach_current_token_triggers: у %.% немає колонки id типу uuid', 'public', v_base
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT a.attnum INTO v_fk_att FROM pg_attribute a
   WHERE a.attrelid = registry AND a.attname = fk AND a.atttypid = 'uuid'::regtype
     AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_fk_att IS NULL THEN
    RAISE EXCEPTION 'attach_current_token_triggers: колонка "%" у %.% має бути типу uuid', fk, 'public', v_reg
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint k,
                              unnest(k.conkey, k.confkey) AS u(src, dst)
                  WHERE k.contype = 'f' AND k.conrelid = registry
                    AND k.confrelid = base AND u.src = v_fk_att AND u.dst = v_id_att) THEN
    RAISE EXCEPTION 'attach_current_token_triggers: колонка "%" у %.% має бути зовнішнім ключем на %.%(id)',
      fk, 'public', v_reg, 'public', v_base USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_b_trg := left(v_base, 63 - length('_cur_tok_b')) || '_cur_tok_b';
  v_r_trg := left(v_reg, 63 - length('_cur_tok_r')) || '_cur_tok_r';

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_b_trg, v_base);
  EXECUTE format(
    'CREATE CONSTRAINT TRIGGER %I AFTER INSERT ON public.%I '
    || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
    || 'EXECUTE FUNCTION public.require_current_token(%L, %L, %L, %L)',
    v_b_trg, v_base, 'base', v_base, v_reg, fk);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_r_trg, v_reg);
  EXECUTE format(
    'CREATE CONSTRAINT TRIGGER %I AFTER DELETE OR UPDATE OF is_current, slug, locale, %I ON public.%I '
    || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW '
    || 'EXECUTE FUNCTION public.require_current_token(%L, %L, %L, %L)',
    v_r_trg, fk, v_reg, 'registry', v_base, v_reg, fk);
END;
$$;

REVOKE ALL ON PROCEDURE public.attach_current_token_triggers(regclass, regclass, text) FROM PUBLIC;

-- ── Підключення до реальних таблиць ─────────────────────────────────────────
-- Наявність адреси товару й токена модифікації (І16, К4): обидва тригери пари —
-- і бази (AFTER INSERT), і реєстру — увімкнені з першого коміту сутності.
CALL public.attach_current_address_triggers('public.products'::regclass, 'public.url_paths'::regclass, 'product_id');
CALL public.attach_current_token_triggers('public.product_modifications'::regclass, 'public.slug_tokens'::regclass, 'modification_id');

-- Обовʼязковий рядок основної мови (І4) товару й модифікації та тексту значення
-- властивості (І5): для значень — лише `value_kind = text`, бо в числа, опції, булевого
-- й кольору тексту немає (CHECK форми значення, І6), а переклад їм не потрібен.
CALL public.attach_source_translation_triggers('public.products'::regclass, 'public.product_translations'::regclass, 'product_id', ARRAY['name']);
CALL public.attach_source_translation_triggers('public.product_modifications'::regclass, 'public.product_modification_translations'::regclass, 'modification_id', ARRAY['name']);
CALL public.attach_source_translation_triggers('public.product_property_values'::regclass, 'public.product_property_value_translations'::regclass, 'value_id', ARRAY['value'], 'value_kind=text');
CALL public.attach_source_translation_triggers('public.modification_property_values'::regclass, 'public.modification_property_value_translations'::regclass, 'value_id', ARRAY['value'], 'value_kind=text');
