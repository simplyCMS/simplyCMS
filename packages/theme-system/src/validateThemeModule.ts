import type { ThemeModule } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Публічний pure-валідатор модуля теми (контракт v2).
 *
 * Тема приходить із зовнішнього пакета, тому її форма — `unknown` доти, доки
 * не перевірена тут. Реєстр не має власної приватної валідації: єдина
 * реалізація контракту живе в цій функції.
 */
export function validateThemeModule(m: unknown): asserts m is ThemeModule {
  if (!isRecord(m)) {
    throw new Error('[theme] Модуль теми має бути обʼєктом');
  }

  const { manifest, tokens, components, settings } = m;

  if (!isRecord(manifest)) {
    throw new Error('[theme] Відсутній manifest');
  }

  if (
    typeof manifest.name !== 'string' ||
    typeof manifest.displayName !== 'string' ||
    typeof manifest.version !== 'string'
  ) {
    throw new Error(
      '[theme] Неповний manifest: потрібні name, displayName, version',
    );
  }

  const engines = manifest.engines;
  if (!isRecord(engines) || typeof engines.simplycms !== 'string') {
    throw new Error(
      `[theme] "${manifest.name}": manifest.engines.simplycms обовʼязковий (діапазон сумісності з ядром)`,
    );
  }

  if (!isRecord(tokens)) {
    throw new Error(`[theme] "${manifest.name}": відсутні tokens`);
  }

  if (!isRecord(components)) {
    throw new Error(`[theme] "${manifest.name}": відсутні components`);
  }

  if (typeof components.Header !== 'function') {
    throw new Error(`[theme] "${manifest.name}": відсутній components.Header`);
  }

  if (typeof components.Footer !== 'function') {
    throw new Error(`[theme] "${manifest.name}": відсутній components.Footer`);
  }

  if (settings !== undefined && !isRecord(settings)) {
    throw new Error(
      `[theme] "${manifest.name}": settings мають бути обʼєктом схеми налаштувань`,
    );
  }
}
