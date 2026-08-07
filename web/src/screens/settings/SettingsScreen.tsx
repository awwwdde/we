import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { ApiError, api } from '@/lib/api/client';
import { deviceInviteSchema, deviceListSchema, type DeviceInvite } from '@/lib/api/schemas';
import { useSession } from '@/lib/auth/session';
import {
  fetchPushStatus,
  isPushSupported,
  isStandalone,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushBlocker,
} from '@/lib/push/subscribe';
import { formatDayShort, utcToZoned } from '@/lib/time';
import { PERSON_VAR } from '@/types/person';

/** «вход сегодня» / «вход 3 авг» / «ещё не входили». */
function lastSeen(iso: string | null): string {
  if (!iso) return 'ещё не входили';
  const when = utcToZoned(iso);
  const today = new Date();
  const sameDay =
    when.getDate() === today.getDate() &&
    when.getMonth() === today.getMonth() &&
    when.getFullYear() === today.getFullYear();
  return sameDay ? 'вход сегодня' : `вход ${formatDayShort(when)}`;
}

/**
 * Настройки (макет, раздел 05).
 *
 * Мини-сфера вместо аватара: цвет человека и есть его лицо. Крестик отзыва
 * занимает положенные 44px, но визуально тихий — это редкое действие.
 */
export function SettingsScreen() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const queryClient = useQueryClient();

  const [invite, setInvite] = useState<DeviceInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => api('/auth/devices', { schema: deviceListSchema }),
  });

  const createInvite = useMutation({
    mutationFn: () => api('/auth/devices/invite', { method: 'POST', schema: deviceInviteSchema }),
    onSuccess: (data) => {
      setInvite(data);
      setError(null);
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Не получилось выдать код'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Не получилось отозвать'),
  });

  const push = useQuery({ queryKey: ['push-status'], queryFn: fetchPushStatus });

  /** Понятная причина, почему подписаться не вышло (ТЗ 13.6). */
  const BLOCKER_TEXT: Record<Exclude<PushBlocker, null>, string> = {
    unsupported: 'Это устройство не умеет push-уведомления.',
    'not-standalone':
      'Нужно открыть приложение с домашнего экрана. В браузерной вкладке ' +
      'на iPhone подписка не создаётся вовсе.',
    denied: 'Разрешение не выдано. Включить можно в настройках устройства.',
    'not-configured': 'Уведомления пока не настроены на сервере.',
  };

  const enablePush = useMutation({
    mutationFn: subscribeToPush,
    onSuccess: (blocker) => {
      setPushNote(blocker ? BLOCKER_TEXT[blocker] : null);
      void queryClient.invalidateQueries({ queryKey: ['push-status'] });
    },
    onError: () => setPushNote('Не получилось подписаться.'),
  });

  const disablePush = useMutation({
    mutationFn: unsubscribeFromPush,
    onSuccess: () => {
      setPushNote(null);
      void queryClient.invalidateQueries({ queryKey: ['push-status'] });
    },
  });

  const testPush = useMutation({
    mutationFn: sendTestPush,
    onSuccess: () => setPushNote('Отправлено. Если не пришло — доставка не мгновенна.'),
    onError: () => setPushNote('Ни одно устройство не приняло уведомление.'),
  });

  const subscribed = (push.data?.subscriptions ?? 0) > 0;

  return (
    <Screen title="Настройки">
      {user && (
        <div className="mb-10 flex items-center gap-4">
          {/* Мини-сфера вместо аватара. */}
          <span
            aria-hidden
            className="h-12 w-12 shrink-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 38% 38%, ${PERSON_VAR[user.color]}, transparent 70%)`,
            }}
          />
          <div>
            <p className="text-title">{user.display_name}</p>
            <p className="font-mono text-label uppercase text-mist">{user.color} · автор</p>
          </div>
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 font-mono text-label uppercase text-mist">Устройства</h2>

        {devices.isPending && <p className="text-caption text-mist">Загружаю…</p>}
        {devices.isError && <p className="text-caption text-mist">Не удалось загрузить список.</p>}

        <ul className="flex flex-col">
          {devices.data?.map((device) => (
            <li
              key={device.id}
              className="flex items-center justify-between gap-3 border-b border-stroke py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-body">{device.device_label ?? 'Без названия'}</p>
                <p className="font-mono text-label uppercase text-mist">
                  добавлено {formatDayShort(utcToZoned(device.created_at))} ·{' '}
                  {lastSeen(device.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke.mutate(device.id)}
                aria-label={`Отозвать ${device.device_label ?? 'устройство'}`}
                className="flex min-h-tap min-w-tap items-center justify-center text-title text-ghost"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-mono text-label uppercase text-mist">Уведомления</h2>

        {!isPushSupported() ? (
          <p className="text-caption text-mist">{BLOCKER_TEXT.unsupported}</p>
        ) : !isStandalone() ? (
          <p className="text-caption text-mist">{BLOCKER_TEXT['not-standalone']}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-caption text-mist">
              {subscribed
                ? 'Это устройство получает уведомления.'
                : 'Приглашения и напоминания за сутки и за 2 часа.'}
            </p>
            {subscribed ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => testPush.mutate()}
                  loading={testPush.isPending}
                >
                  Проверить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => disablePush.mutate()}
                  loading={disablePush.isPending}
                >
                  Отключить на этом устройстве
                </Button>
              </>
            ) : (
              <Button onClick={() => enablePush.mutate()} loading={enablePush.isPending}>
                Включить уведомления
              </Button>
            )}
          </div>
        )}

        {pushNote && <p className="mt-3 text-caption text-linen">{pushNote}</p>}
      </section>

      <section className="mb-10">
        {invite ? (
          <div className="rounded-card border border-stroke bg-surface p-5 text-center">
            <p className="font-mono text-title tracking-[0.16em]">{invite.code}</p>
            <p className="mt-2 text-caption text-mist">
              Введите его на новом телефоне в течение 10 минут.
            </p>
          </div>
        ) : (
          <Button
            variant="ghost"
            onClick={() => createInvite.mutate()}
            loading={createInvite.isPending}
          >
            Получить код для устройства
          </Button>
        )}
      </section>

      {error && (
        <p role="alert" className="mb-6 text-caption" style={{ color: PERSON_VAR.ember }}>
          {error}
        </p>
      )}

      <Button
        variant="ghost"
        onClick={() => {
          void signOut().then(() => navigate('/onboarding', { replace: true }));
        }}
      >
        Выйти
      </Button>
    </Screen>
  );
}
