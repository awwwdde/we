import type { ChangeEvent } from 'react';

type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * Поле для кода вида `7K2M-9QX4-LP31`.
 *
 * Размер шрифта 16px обязателен: при меньшем Safari зумит страницу на фокусе,
 * и вернуть масштаб уже нельзя (ТЗ 15.3).
 */
export function CodeInput({ value, onChange, placeholder, autoFocus }: CodeInputProps) {
  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value.toUpperCase());
  };

  return (
    <input
      value={value}
      onChange={handle}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoCapitalize="characters"
      autoComplete="one-time-code"
      spellCheck={false}
      inputMode="text"
      className="min-h-tap w-full rounded-card border border-stroke bg-surface2 px-5 py-4
                 text-center font-mono text-[19px] uppercase leading-[26px] tracking-[0.16em] text-chalk
                 placeholder:text-ghost focus:border-mist focus:outline-none"
    />
  );
}
