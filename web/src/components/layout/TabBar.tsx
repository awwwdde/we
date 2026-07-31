import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

import { spring } from '@/lib/motion/presets';

type IconProps = { className?: string | undefined };

const iconBase = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function OrbIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className} aria-hidden>
      <circle cx="9.5" cy="12" r="5.5" />
      <circle cx="15.5" cy="12" r="5.5" opacity="0.5" />
    </svg>
  );
}

function SparkIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className} aria-hidden>
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function HistoryIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className} aria-hidden>
      <path d="M5 8h14M5 16h14" />
      <circle cx="10" cy="8" r="2" />
      <circle cx="15" cy="16" r="2" />
    </svg>
  );
}

type Tab = {
  to: string;
  label: string;
  Icon: (props: IconProps) => JSX.Element;
  accent?: boolean;
};

const TABS: readonly Tab[] = [
  { to: '/', label: 'Главная', Icon: OrbIcon },
  { to: '/create', label: 'Задумать', Icon: SparkIcon, accent: true },
  { to: '/history', label: 'История', Icon: HistoryIcon },
  { to: '/settings', label: 'Настройки', Icon: SettingsIcon },
];

/** Плавающий pill-таббар (ТЗ 6.2). */
export function TabBar() {
  return (
    <nav
      className="glass fixed left-1/2 z-40 -translate-x-1/2 rounded-pill px-2 py-2"
      style={{ bottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      aria-label="Основная навигация"
    >
      <ul className="flex items-center gap-1">
        {TABS.map(({ to, label, Icon, accent }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              aria-label={label}
              className="relative flex min-h-tap min-w-tap flex-col items-center justify-center gap-1 rounded-pill px-4"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="tabbar-active"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-pill bg-surface2"
                    />
                  )}
                  <span
                    className={[
                      'relative transition-colors',
                      isActive ? 'text-chalk' : 'text-mist',
                    ].join(' ')}
                    style={
                      accent
                        ? { color: isActive ? 'var(--person-color)' : undefined }
                        : undefined
                    }
                  >
                    <Icon className={accent ? 'scale-125' : undefined} />
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
