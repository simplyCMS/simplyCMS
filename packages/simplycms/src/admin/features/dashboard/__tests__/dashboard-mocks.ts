// Спільні моки межі дашборду (Task 8, Е6г): `vi.mock` у тест-файлах бере їх
// динамічним імпортом, бо фабрики hoisted і не бачать звичайних змінних.
import { vi } from 'vitest';

export const dashboardSummary = vi.fn();
export const listOrderStatuses = vi.fn(async () => [] as unknown[]);
export const slot = vi.fn();
