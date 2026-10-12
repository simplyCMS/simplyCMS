-- Оверлей ПІЛОТА поверх демо-сіду: проба серверного `sanitize-html` для кроку Gate B
-- «sanitize-html на сервері» (`gate-b.mjs`). Накатує лише `apply-probe.mjs` (його викликає
-- `scripts/release/pilot-full.mjs`) і лише на БД пілота. 🔴 НЕ частина демо-сіду, пакета чи шаблону:
-- брудна розмітка в продуктових даних магазину — зразок, якого там бути не мусить
-- (стереже `tests/demo-seed-clean.test.ts`; що оверлей не їде в tarball — `tests/pilot-probe-not-packed.test.ts`).
--
-- 🔴 Не «спрощувати» до тексту чи чистої розмітки. У серверний бандл скретча вклеєні dual-пакети
-- (`postcss`, `is-plain-object`, `nanoid`), які `sanitize-html` бере через `require()`; вони безпечні,
-- лише поки споживач бере іменовані експорти (`UPSTREAM:START-IP-1`). Проба йде через `style` на `<p>`,
-- бо саме ця гілка `sanitize-html` реально викликає `postcss.parse` (мутація «postcssParse → undefined»
-- у бандлі скретча червонить Gate B); `title` на `<a>` чи `onerror` до `postcss`/`isPlainObject` не
-- доходять і дали б хибно-зелений крок. Очікування на SSR: `<strong>`, `<a href>` і `text-align`
-- дожили; `<script>`, `onerror`, `title`, `color` зникли.
update public.products
   set description = '<p style="text-align: center; color: red">Мережевий інвертор 5 кВт із ККД до <strong>98%</strong>, доступний в однофазному та трифазному виконанні.</p><a href="https://example.com/inverter" title="t">специфікація</a><script>alert(1)</script><img src="x" onerror="alert(2)">'
 where slug = 'invertor-merezhevyi-5kw';
