import { create } from 'zustand';

import { api, refreshSession, setAccessToken } from '@/lib/api/client';
import { userSchema, type User } from '@/lib/api/schemas';

type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  /** Восстановить сессию по refresh-cookie при запуске приложения. */
  restore: () => Promise<void>;
  signIn: (accessToken: string, user: User) => void;
  signOut: () => Promise<void>;
};

/**
 * Состояние сессии.
 *
 * Пользователь здесь, access-токен — в модуле api/client (в памяти).
 * Ничего не сохраняется в localStorage: при перезапуске сессия
 * восстанавливается из httpOnly-cookie через `restore()`.
 */
export const useSession = create<SessionState>((set) => ({
  status: 'unknown',
  user: null,

  restore: async () => {
    const token = await refreshSession();
    if (!token) {
      set({ status: 'anonymous', user: null });
      return;
    }
    try {
      // Токен есть, но кто мы — знает только сервер.
      const user = await api('/auth/me', { schema: userSchema });
      set({ status: 'authenticated', user });
    } catch {
      setAccessToken(null);
      set({ status: 'anonymous', user: null });
    }
  },

  signIn: (accessToken, user) => {
    setAccessToken(accessToken);
    set({ status: 'authenticated', user });
  },

  signOut: async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      set({ status: 'anonymous', user: null });
    }
  },
}));
