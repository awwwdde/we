import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { ApiError, api } from '@/lib/api/client';
import { deviceInviteSchema, deviceListSchema, type DeviceInvite } from '@/lib/api/schemas';
import { useSession } from '@/lib/auth/session';
import { PERSON_HEX } from '@/types/person';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const queryClient = useQueryClient();

  const [invite, setInvite] = useState<DeviceInvite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => api('/auth/devices', { schema: deviceListSchema }),
  });

  const createInvite = useMutation({
    mutationFn: () =>
      api('/auth/devices/invite', { method: 'POST', schema: deviceInviteSchema }),
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

  return (
    <Screen title="Настройки">
      {user && (
        <div className="mb-8 flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: PERSON_HEX[user.color] }}
            aria-hidden
          />
          <span className="text-body">{user.display_name}</span>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-mono text-label uppercase text-mist">Устройства</h2>

        {devices.isPending && <p className="text-caption text-mist">Загружаю…</p>}

        {devices.isError && (
          <p className="text-caption text-mist">Не удалось загрузить список.</p>
        )}

        <ul className="flex flex-col gap-2">
          {devices.data?.map((device) => (
            <li
              key={device.id}
              className="flex items-center justify-between gap-3 rounded-card bg-surface p-4"
            >
              <div>
                <p className="text-body">{device.device_label ?? 'Без названия'}</p>
                <p className="font-mono text-label uppercase text-ghost">
                  добавлено {formatDate(device.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke.mutate(device.id)}
                className="min-h-tap min-w-tap px-3 text-caption text-mist"
              >
                Отозвать
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-mono text-label uppercase text-mist">Новое устройство</h2>

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
            Получить код
          </Button>
        )}
      </section>

      {error && (
        <p role="alert" className="mb-6 text-caption" style={{ color: PERSON_HEX.ember }}>
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
