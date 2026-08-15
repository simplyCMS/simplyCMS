import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  };
}

export function GitHubIcon(props: IconProps) {
  const { size = 18, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...rest}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function NpmIcon(props: IconProps) {
  const { size = 18, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...rest}
    >
      <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0ZM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113Z" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  const { size = 15, ...rest } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...rest}
    >
      <path d="M12 2.5 15 9l7 .8-5.2 4.7 1.4 6.9L12 17.9l-6.2 3.5 1.4-6.9L2 9.8 9 9l3-6.5Z" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base({ size: 12, ...props })}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base({ size: 14, ...props })}>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base({ size: 15, strokeWidth: 3, ...props })}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base({ size: 14, ...props })}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Логомарк SimplyCMS: бурштиновий цінник-таг на темному квадраті. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8.5" fill="#F0B429" />
      <path
        d="M17.3 6.9h6.1c1 0 1.7.8 1.7 1.7v6.1c0 .5-.2.9-.5 1.2l-8.9 8.9c-.7.7-1.8.7-2.4 0l-6.1-6.1c-.7-.7-.7-1.8 0-2.4l8.9-8.9c.3-.3.7-.5 1.2-.5Z"
        fill="#191203"
      />
      <circle cx="21.4" cy="10.6" r="1.7" fill="#F0B429" />
    </svg>
  );
}

/* ---------- Мітки сервісів live-метрик ---------- */

export function PulseDot() {
  return <span className="dot" aria-hidden />;
}

/* ---------- Логотипи стека (спрощені впізнавані марки) ---------- */

export function ReactLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="2.1" fill="#61DAFB" />
      <g stroke="#61DAFB" strokeWidth="1.1">
        <ellipse cx="12" cy="12" rx="10" ry="4.2" />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4.2"
          transform="rotate(60 12 12)"
        />
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4.2"
          transform="rotate(120 12 12)"
        />
      </g>
    </svg>
  );
}

export function TypeScriptLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#3178C6" />
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque', sans-serif"
        fontWeight="750"
        fontSize="10.5"
        fill="#fff"
      >
        TS
      </text>
    </svg>
  );
}

export function ViteLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="vite-v" x1="3" y1="2" x2="19" y2="22">
          <stop offset="0" stopColor="#41D1FF" />
          <stop offset="1" stopColor="#BD34FE" />
        </linearGradient>
        <linearGradient id="vite-b" x1="10" y1="2" x2="14" y2="18">
          <stop offset="0" stopColor="#FFEA83" />
          <stop offset="1" stopColor="#FFA800" />
        </linearGradient>
      </defs>
      <path
        d="M23 3.4 12.6 22a.66.66 0 0 1-1.16.01L1 3.4c-.27-.48.18-1.05.72-.95l10.16 1.82c.08.01.16.01.24 0L22.28 2.45c.54-.1.99.47.72.95Z"
        fill="url(#vite-v)"
      />
      <path
        d="m16.5 1.6-5.9 1.16a.33.33 0 0 0-.26.3l-.36 6.14c-.01.24.21.43.44.37l1.64-.38c.26-.06.49.17.44.43l-.49 2.39c-.06.27.2.5.46.42l1.01-.31c.26-.08.52.15.46.42l-.77 3.74c-.08.4.44.61.66.27l.15-.23 4.79-9.57c.13-.27-.1-.57-.39-.51l-1.69.32c-.27.05-.49-.2-.42-.46l1.1-3.82a.38.38 0 0 0-.44-.48Z"
        fill="url(#vite-b)"
      />
    </svg>
  );
}

export function SupabaseLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13.4 22.3c-.5.63-1.52.28-1.53-.53l-.18-9.31h6.35c1.15 0 1.79 1.33 1.08 2.23l-5.72 7.61Z"
        fill="#3ECF8E"
      />
      <path
        d="M10.6 1.7c.5-.63 1.52-.28 1.53.53l.08 9.31H5.96c-1.15 0-1.79-1.33-1.08-2.23L10.6 1.7Z"
        fill="#3ECF8E"
        opacity="0.65"
      />
    </svg>
  );
}

export function TailwindLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#38BDF8" aria-hidden>
      <path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C13.39 10.85 14.53 12 17 12c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C15.61 7.15 14.47 6 12 6ZM7 12c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5.76.19 1.31.74 1.91 1.35C8.39 16.85 9.53 18 12 18c2.67 0 4.33-1.33 5-4-1 1.33-2.17 1.83-3.5 1.5-.76-.19-1.31-.74-1.91-1.35C10.61 13.15 9.47 12 7 12Z" />
    </svg>
  );
}

export function ShadcnLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        width="23"
        height="23"
        x="0.5"
        y="0.5"
        rx="5"
        stroke="currentColor"
        opacity="0.6"
      />
      <path
        d="M16.5 5 5 16.5M19 11.5 11.5 19"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DrizzleLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="#C5F74F" aria-hidden>
      <rect
        x="3.5"
        y="6"
        width="8.2"
        height="2.7"
        rx="1.35"
        transform="rotate(-28 3.5 6)"
      />
      <rect
        x="12.8"
        y="3.6"
        width="8.2"
        height="2.7"
        rx="1.35"
        transform="rotate(-28 12.8 3.6)"
      />
      <rect
        x="4.6"
        y="16.9"
        width="8.2"
        height="2.7"
        rx="1.35"
        transform="rotate(-28 4.6 16.9)"
      />
      <rect
        x="13.9"
        y="14.5"
        width="8.2"
        height="2.7"
        rx="1.35"
        transform="rotate(-28 13.9 14.5)"
      />
    </svg>
  );
}

export function ZodLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 21 6v6.2c0 4.9-3.8 8.6-9 9.8-5.2-1.2-9-4.9-9-9.8V6l9-4Z"
        fill="#3E67B1"
      />
      <path d="M8 8.4h8l-5.4 6.1H16v1.8H8l5.4-6.1H8V8.4Z" fill="#fff" />
    </svg>
  );
}

export function PnpmLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="6" height="6" fill="#F9AD00" />
      <rect x="9" y="2" width="6" height="6" fill="#F9AD00" />
      <rect x="16" y="2" width="6" height="6" fill="#F9AD00" />
      <rect x="16" y="9" width="6" height="6" fill="#F9AD00" />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="9"
        y="16"
        width="6"
        height="6"
        fill="currentColor"
        opacity="0.85"
      />
      <rect
        x="16"
        y="16"
        width="6"
        height="6"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

export function TanStackLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3.2" width="18" height="4.6" rx="2.3" fill="#06B6D4" />
      <rect x="5" y="9.7" width="14" height="4.6" rx="2.3" fill="#F0B429" />
      <rect x="7" y="16.2" width="10" height="4.6" rx="2.3" fill="#F43F5E" />
    </svg>
  );
}
