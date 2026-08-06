import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  children: ReactNode;
};

/**
 * Кнопка. Высота не меньше 44px — минимальная зона нажатия (ТЗ 15.2).
 * Основная подсвечена цветом текущего пользователя.
 */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex min-h-tap w-full items-center justify-center rounded-pill px-6 text-body ' +
    'font-medium transition-opacity disabled:opacity-40';

  const look =
    variant === 'primary'
      ? 'text-coal'
      : 'bg-surface2 text-chalk';

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={[base, look, className].filter(Boolean).join(' ')}
      style={variant === 'primary' ? { background: 'var(--person-color)' } : undefined}
      {...rest}
    >
      {loading ? 'Секунду…' : children}
    </button>
  );
}
