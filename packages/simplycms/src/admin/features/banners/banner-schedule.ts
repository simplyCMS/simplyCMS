import type { Banner } from 'simplycms/schema/types';

/** Банер має хоч одне обмеження показу: дати, дні тижня чи години. */
export function isBannerScheduled(b: Banner): boolean {
  return (
    b.dateFrom !== null ||
    b.dateTo !== null ||
    (b.scheduleDays?.length ?? 0) > 0 ||
    b.scheduleTimeFrom !== null ||
    b.scheduleTimeTo !== null
  );
}
