import { vi } from 'vitest';

/** Моки межі serverFn і UI-оточення (окремий модуль для `vi.mock`-фабрик). */
export const mocks = {
  listReviews: vi.fn(),
  countPendingReviews: vi.fn(),
  getReviewCard: vi.fn(),
  setReviewsStatus: vi.fn(),
  deleteReview: vi.fn(),
};

export const ui = {
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  navigate: vi.fn(async () => {}),
};
