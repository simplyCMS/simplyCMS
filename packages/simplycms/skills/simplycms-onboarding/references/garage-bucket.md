# Бакет S3 (Garage)

> Це наш варіант інфраструктури (спільний Garage у приватній мережі). Магазин стороннього власника
> приносить будь-яке S3: потрібні лише п'ять змінних `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
> `S3_ACCESS_KEY`, `S3_SECRET_KEY`, і крок «бакет» тоді робить власник у своєму сервісі.

Крок власника на хості Garage (`<garage>` — команда garage з вашого розгортання). Ім'я бакета: 3–63 символи,
малі літери, цифри, дефіс. Скіл ці команди НЕ виконує.

1. Бакет і квота:
   ```sh
   <garage> bucket create <бакет>
   <garage> bucket set-quotas --max-size 10GiB <бакет>
   ```
2. Ключ — одразу у файл на хості:
   ```sh
   umask 077; mkdir -p /etc/garage/keys
   [ -s /etc/garage/keys/<бакет>.txt ] || <garage> key create <бакет>-app > /etc/garage/keys/<бакет>.txt
   ```
3. Права — лише читання й запис, **без `--owner`** (власник бакета змінює його політики; витік ключа
   застосунку не має давати цього):
   ```sh
   <garage> bucket allow --read --write <бакет> --key <бакет>-app
   <garage> bucket info <бакет>
   ```
4. Змінні: `S3_ENDPOINT` (приватна адреса S3 API), `S3_REGION=garage`, `S3_BUCKET`, `S3_ACCESS_KEY` (`GK…`),
   `S3_SECRET_KEY` (рядок `Secret key`). Власник вносить їх у файл секретів; далі — `pipe` у `dokploy-env`.
   Після запису — редеплой.
5. Перевірка з контейнера застосунку:
   ```sh
   docker exec <контейнер> node -e "fetch('<S3_ENDPOINT>/').then(r=>console.log(r.status))"
   ```
   `403` = мережа є, Garage відповідає. Таймаут — сервер не в приватній мережі чи порт прив'язано не туди.
