// Позитивний контроль: канонічна форма.
import { afterEach } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';

afterEach(cleanup);
export const ok = () => renderHook(() => 1);
