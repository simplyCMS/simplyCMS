import { describe, expect, it, vi } from 'vitest';

vi.mock('simplycms/db', () => ({ withActor: vi.fn() }));

import { errorText } from '../outbox-delivery';

describe('errorText: маскування персональних даних', () => {
  it('ховає адреси з TLD і без нього (user@localhost)', () => {
    expect(errorText(new Error('rcpt a.b+c@shop.example відхилено'))).toBe(
      'rcpt <email> відхилено',
    );
    expect(errorText(new Error('rcpt user@localhost відхилено'))).toBe(
      'rcpt <email> відхилено',
    );
  });

  it('userinfo URL маскується redactUrls і не стає <email>', () => {
    const out = errorText(new Error('connect smtp://user:pw@mail.local:25'));
    expect(out).toBe('connect smtp://***@mail.local:25');
  });
});
