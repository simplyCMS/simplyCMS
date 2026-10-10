import { z } from 'zod';
import {
  BANNER_ANIMATIONS,
  BANNER_BUTTON_TARGETS,
  BANNER_BUTTON_VARIANTS,
  BANNER_PLACEMENTS,
  BANNER_TEXT_POSITIONS,
} from 'simplycms/contracts';
import {
  BANNER_ANIMATION_MS,
  BANNER_MAX_BUTTONS,
  BANNER_SLIDE_MS,
  BANNER_TIME_RE,
  isBannerButton,
  isSafeCssValue,
} from 'simplycms/domain';

/** Порожній час — «без обмеження»; формат `HH:MM` дає `<input type="time">`. */
const timeOrEmpty = z
  .string()
  .refine((v) => v === '' || BANNER_TIME_RE.test(v));

/**
 * Значення форми банера. Правила — ті самі T0/T1-предикати, що в ресурсі
 * сервера (Е6д-3): друга копія правила розійшлась би з першою.
 */
export const bannerFormSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().max(500),
    imageUrl: z.string().min(1),
    desktopImageUrl: z.string(),
    mobileImageUrl: z.string(),
    textPosition: z.enum(BANNER_TEXT_POSITIONS),
    overlayColor: z.string().refine((v) => v === '' || isSafeCssValue(v)),
    buttons: z
      .array(
        z
          .object({
            text: z.string(),
            url: z.string(),
            target: z.enum(BANNER_BUTTON_TARGETS),
            variant: z.enum(BANNER_BUTTON_VARIANTS),
          })
          .refine((b) =>
            isBannerButton({ ...b, text: b.text.trim(), url: b.url.trim() }),
          ),
      )
      .max(BANNER_MAX_BUTTONS),
    placement: z.enum(BANNER_PLACEMENTS),
    sectionId: z.string(),
    dateFrom: z.string(),
    dateTo: z.string(),
    scheduleDays: z.array(z.number().int().min(0).max(6)),
    scheduleTimeFrom: timeOrEmpty,
    scheduleTimeTo: timeOrEmpty,
    slideDuration: z.number().min(BANNER_SLIDE_MS.min).max(BANNER_SLIDE_MS.max),
    animationType: z.enum(BANNER_ANIMATIONS),
    animationDuration: z
      .number()
      .min(BANNER_ANIMATION_MS.min)
      .max(BANNER_ANIMATION_MS.max),
    sortOrder: z.coerce.number().int().min(0),
    isActive: z.boolean(),
  })
  .refine((v) => v.placement !== 'section' || v.sectionId !== '', {
    path: ['sectionId'],
  });

export type BannerFormInput = z.input<typeof bannerFormSchema>;
export type BannerFormValues = z.output<typeof bannerFormSchema>;

export const EMPTY_BANNER: BannerFormInput = {
  title: '',
  subtitle: '',
  imageUrl: '',
  desktopImageUrl: '',
  mobileImageUrl: '',
  textPosition: 'left',
  overlayColor: 'rgba(0,0,0,0.4)',
  buttons: [],
  placement: 'home',
  sectionId: '',
  dateFrom: '',
  dateTo: '',
  scheduleDays: [],
  scheduleTimeFrom: '',
  scheduleTimeTo: '',
  slideDuration: 5000,
  animationType: 'slide',
  animationDuration: 500,
  sortOrder: 0,
  isActive: true,
};
