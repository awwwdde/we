import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';
import { OrbField } from '@/components/orb/OrbField';
import { Button } from '@/components/ui/Button';
import { CodeInput } from '@/components/ui/CodeInput';
import { ApiError } from '@/lib/api/client';
import {
  PasskeyCancelled,
  isPasskeySupported,
  loginWithPasskey,
  loginWithRecoveryCode,
  registerPasskey,
} from '@/lib/auth/passkey';
import { DEV_LOGIN_AVAILABLE, devLogin } from '@/lib/auth/devLogin';
import { useSession } from '@/lib/auth/session';
import { PERSON_HEX } from '@/types/person';

type Step = 'welcome' | 'invite' | 'recovery-input' | 'codes';

/** Понятная подпись устройства в списке в настройках. */
function guessDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Устройство';
}

export function OnboardingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useSession((s) => s.signIn);

  const [step, setStep] = useState<Step>('welcome');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const supported = isPasskeySupported();

  const handle = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err instanceof PasskeyCancelled) {
        setError(null);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не получилось. Попробуйте ещё раз.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onDevLogin = (username: string) =>
    handle(async () => {
      const session = await devLogin(username);
      signIn(session.access_token, session.user);
      navigate('/', { replace: true });
    });

  const onLogin = () =>
    handle(async () => {
      const session = await loginWithPasskey();
      signIn(session.access_token, session.user);
      navigate(from, { replace: true });
    });

  const onRegister = () =>
    handle(async () => {
      const result = await registerPasskey(code, guessDeviceLabel());
      if (result.recovery_codes.length > 0) {
        setRecoveryCodes(result.recovery_codes);
        setStep('codes');
      } else {
        // Второе устройство: коды уже выданы раньше, показывать нечего.
        navigate('/', { replace: true });
      }
    });

  const onRecovery = () =>
    handle(async () => {
      const session = await loginWithRecoveryCode(code);
      signIn(session.access_token, session.user);
      navigate('/settings', { replace: true });
    });

  // После регистрации сессия уже есть (сервер выдал refresh-cookie),
  // но зайти внутрь можно только прочитав коды восстановления.
  const onCodesSaved = () =>
    handle(async () => {
      await useSession.getState().restore();
      navigate('/', { replace: true });
    });

  if (!supported) {
    return (
      <>
        <OrbField state="apart" className="fixed" />
        <Screen withTabBar={false}>
          <div className="relative flex min-h-[80dvh] flex-col justify-end">
            <h1 className="font-display text-display-l uppercase">Нужна свежая версия</h1>
            <p className="mt-3 text-body text-mist">
              Это устройство не умеет passkey. На iPhone помогает обновление iOS
              до 17 или новее — в более старых версиях вход по Face ID
              в установленном приложении не работает.
            </p>
          </div>
        </Screen>
      </>
    );
  }

  return (
    <>
      <OrbField state={step === 'codes' ? 'pulling' : 'apart'} className="fixed" />

      <Screen withTabBar={false}>
        <div className="relative flex min-h-[86dvh] flex-col justify-end gap-6">
          {step === 'welcome' && (
            <>
              <div>
                <p className="font-mono text-label uppercase text-mist">Только для двоих</p>
                <h1 className="mt-3 font-display text-display-xl uppercase">Перигей</h1>
                <p className="mt-3 max-w-[30ch] text-body text-mist">
                  Пароля нет. Вход — по Face ID или Touch ID.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Button onClick={onLogin} loading={busy}>
                  Войти
                </Button>
                <Button variant="ghost" onClick={() => setStep('invite')}>
                  У меня код приглашения
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('recovery-input')}
                  className="min-h-tap text-caption text-ghost underline-offset-4 hover:underline"
                >
                  Потерян доступ ко всем устройствам
                </button>
              </div>

              {DEV_LOGIN_AVAILABLE && (
                <div className="mt-2 rounded-card border border-dashed border-stroke p-4">
                  <p className="font-mono text-label uppercase text-ghost">
                    Отладка · в прод-сборке этого блока нет
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" onClick={() => onDevLogin('vlad')}>
                      Войти как Влад
                    </Button>
                    <Button variant="ghost" onClick={() => onDevLogin('angelina')}>
                      Войти как Ангелина
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'invite' && (
            <>
              <div>
                <p className="font-mono text-label uppercase text-mist">Шаг 1 из 2</p>
                <h1 className="mt-3 font-display text-display-l uppercase">Код приглашения</h1>
                <p className="mt-3 max-w-[30ch] text-body text-mist">
                  Одноразовый код на 24 часа. После него появится системный
                  запрос — подтвердите его биометрией.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <CodeInput value={code} onChange={setCode} placeholder="XXXX-XXXX-XXXX" autoFocus />
                <Button onClick={onRegister} loading={busy} disabled={code.length < 12}>
                  Создать passkey
                </Button>
                <Button variant="ghost" onClick={() => setStep('welcome')}>
                  Назад
                </Button>
              </div>
            </>
          )}

          {step === 'recovery-input' && (
            <>
              <div>
                <p className="font-mono text-label uppercase text-mist">Восстановление</p>
                <h1 className="mt-3 font-display text-display-l uppercase">Код из десяти</h1>
                <p className="mt-3 max-w-[30ch] text-body text-mist">
                  Введите один из кодов, сохранённых при первом входе. Он
                  сработает один раз — сразу после входа привяжите новый passkey.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <CodeInput value={code} onChange={setCode} placeholder="XXXX-XXXX-XXXX" autoFocus />
                <Button onClick={onRecovery} loading={busy} disabled={code.length < 12}>
                  Войти по коду
                </Button>
                <Button variant="ghost" onClick={() => setStep('welcome')}>
                  Назад
                </Button>
              </div>
            </>
          )}

          {step === 'codes' && (
            <>
              <div>
                <p className="font-mono text-label uppercase text-mist">Шаг 2 из 2</p>
                <h1 className="mt-3 font-display text-display-l uppercase">Сохраните коды</h1>
                <p className="mt-3 max-w-[32ch] text-body text-mist">
                  Показываются один раз. Если потеряете телефон, войти можно
                  будет только по одному из них.
                </p>
              </div>

              <ul className="grid grid-cols-2 gap-2 rounded-card border border-stroke bg-surface p-4">
                {recoveryCodes.map((item) => (
                  <li key={item} className="font-mono text-caption tracking-[0.08em] text-chalk">
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3">
                <Button
                  variant="ghost"
                  onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}
                >
                  Скопировать
                </Button>
                <Button onClick={onCodesSaved} loading={busy}>
                  Я сохранил
                </Button>
              </div>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="text-caption"
              style={{ color: PERSON_HEX.ember }}
            >
              {error}
            </p>
          )}
        </div>
      </Screen>
    </>
  );
}
