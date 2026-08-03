import { create } from 'zustand';

import type { PlaceSnapshot } from '@/lib/api/dates';

/**
 * Черновик свидания (ТЗ 3: Zustand только для этого и UI-флагов).
 *
 * Живёт в памяти до отправки: на сервере он появится готовой записью,
 * а не будет наполняться по шагам. Так мастер можно бросить в любой момент,
 * не оставив мусора в базе.
 */

export type DraftState = {
  day: Date | null;
  hours: number;
  minutes: number;
  isAllDay: boolean;
  place: PlaceSnapshot | null;
  note: string;

  setDay: (day: Date) => void;
  setTime: (hours: number, minutes: number) => void;
  setAllDay: (value: boolean) => void;
  setPlace: (place: PlaceSnapshot) => void;
  setNote: (note: string) => void;
  reset: () => void;
};

const INITIAL = {
  day: null,
  hours: 19,
  minutes: 0,
  isAllDay: false,
  place: null,
  note: '',
} as const;

export const useDateDraft = create<DraftState>((set) => ({
  ...INITIAL,

  setDay: (day) => set({ day }),
  setTime: (hours, minutes) => set({ hours, minutes, isAllDay: false }),
  // «На весь день» снимает время (ТЗ 7.2).
  setAllDay: (value) => set({ isAllDay: value }),
  setPlace: (place) => set({ place }),
  setNote: (note) => set({ note }),
  reset: () => set({ ...INITIAL }),
}));
