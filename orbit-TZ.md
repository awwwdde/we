# ТЗ: приватное PWA для планирования свиданий

**Кодовое имя:** `orbit`
**Пользователей:** ровно 2 (муж и жена). Регистрации нет и не будет.
**Платформа:** installable PWA, приоритет — мобильный iOS/Android.

---

## 0. Как читать этот документ

Реализация идёт **строго по фазам** из раздела 18. Не начинай фазу N+1, пока
фаза N не проходит свои критерии приёмки.

Правила для всего проекта:

- TypeScript в `strict` режиме. `any` запрещён, включая тесты. Если тип
  неизвестен — `unknown` + сужение через type guard.
- Python: полная аннотация типов, `mypy --strict` проходит без ошибок.
- Никаких TODO-заглушек в отданном коде. Если что-то не реализуемо —
  остановись и спроси, не делай мок.
- Каждая новая зависимость — обоснована в PR-описании. Библиотеку календаря,
  UI-кит и state-менеджер тянуть **не надо** (см. раздел 3).

---

## 1. Что это за продукт

Закрытое приложение для двоих. Один человек собирает свидание (дата → время →
место), отправляет второму ссылку-приглашение. Второй открывает ссылку, проходит
короткий шуточный опросник, где кнопка «Нет» убегает от пальца, подтверждает — и
первому прилетает push-уведомление.

**Ключевое ощущение:** это должно быть похоже на нативное приложение, а не на
сайт. Полный экран без адресной строки, иконка на домашнем экране, вход по
Face ID, тактильный отклик, инерционные анимации.

---

## 2. Пользовательские сценарии

### 2.1. Первый запуск (онбординг)

1. Пользователь открывает ссылку в браузере телефона.
2. Приложение определяет режим отображения. Если это **не** standalone —
   показывается экран «Установи на домашний экран» с пошаговой инструкцией,
   разной для iOS Safari и Android Chrome. Дальше пройти нельзя.
3. В standalone-режиме — экран входа: поле для одноразового кода приглашения
   (код генерируется CLI-скриптом на сервере, см. 9.3).
4. После кода — предложение создать passkey. Срабатывает Face ID / Touch ID.
5. После passkey — запрос разрешения на уведомления (обязательно по тапу, см. 13.2).
6. Показываются 10 кодов восстановления с требованием сохранить их.

### 2.2. Создание свидания

1. Главный экран → кнопка «Задумать свидание».
2. **Шаг 1 — дата.** Календарь на месяц, свайп между месяцами. Тап по дню.
3. **Шаг 2 — время.** Барабан-пикер часов и минут + быстрые пресеты
   («Вечером», «После работы», «На весь день»).
4. **Шаг 3 — место.** Поиск с фильтром по категориям. Три источника в одной
   выдаче (см. 12). Тап по карточке → детали → «Выбрать».
5. **Шаг 4 — записка.** Необязательное текстовое поле до 280 символов.
6. **Шаг 5 — превью.** Показывается финальная карточка. Кнопка «Отправить
   приглашение» → генерируется ссылка → системный share-sheet
   (`navigator.share`) с fallback на копирование в буфер.

### 2.3. Получение приглашения

1. Второй открывает ссылку `/i/{token}`. **Авторизация не требуется** — знание
   токена и есть доступ.
2. Экран-конверт: анимация раскрытия, показывается кто, куда и когда.
3. Опросник из 3 шагов (см. 7.6). Кнопка «Нет» уклоняется от нажатия.
4. Подтверждение → сферы сливаются → приглашающему уходит push.

### 2.4. Обычный день

Главный экран показывает ближайшее подтверждённое свидание с обратным отсчётом
внутри слитой сферы, ниже — лента прошедших свиданий.

---

## 3. Стек

### Фронтенд

| Что | Чем | Зачем именно это |
|---|---|---|
| Сборка | Vite 5 + React 18 + TypeScript 5 | по требованию заказчика |
| Стили | Tailwind CSS 3.4 | по требованию |
| Анимации UI | Framer Motion 11 | переходы, layout-анимации, жесты |
| Анимации сцен | GSAP 3.12 | таймлайны сфер, SVG-морфинг |
| Скролл | Lenis 1.x | инерция |
| Роутинг | React Router 6 (data router) | |
| Серверное состояние | TanStack Query 5 | кэш запросов, ретраи, инвалидация |
| Клиентское состояние | Zustand | только для черновика свидания и UI-флагов |
| Формы | React Hook Form + Zod | Zod-схемы переиспользуются как рантайм-валидация ответов API |
| Даты | date-fns + date-fns-tz | |
| Passkeys | @simplewebauthn/browser 10 | |
| PWA | vite-plugin-pwa (Workbox) | |

**Не устанавливать:** UI-киты (MUI, Chakra, shadcn), библиотеки календарей
(react-calendar, react-day-picker), moment.js, axios (хватит `fetch`), Redux.

Календарь пишется руками — это ~150 строк на `date-fns`, зато полный контроль
над анимацией и версткой, а любая готовая библиотека потребует переопределения
всех стилей и всё равно не даст свайп-переходы между месяцами.

### Бэкенд

| Что | Чем |
|---|---|
| Фреймворк | FastAPI 0.115+ |
| ASGI | Uvicorn за Nginx |
| БД | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0 (async, `asyncpg`) |
| Миграции | Alembic |
| Валидация | Pydantic v2 |
| Passkeys | `webauthn` (py_webauthn) 2.x |
| Push | `pywebpush` |
| HTTP-клиент | `httpx` (async) |
| Кэш/очередь | Redis 7 |
| Фоновые задачи | APScheduler (напоминания) |

Python 3.12.

---

## 4. Структура репозитория

```
orbit/
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── web/
│   ├── src/
│   │   ├── app/                    # роутер, провайдеры, layout
│   │   ├── screens/                # экран = папка (компонент + хуки + типы)
│   │   │   ├── onboarding/
│   │   │   ├── home/
│   │   │   ├── create-date/
│   │   │   │   ├── steps/
│   │   │   │   └── useDateDraft.ts
│   │   │   ├── invite/
│   │   │   ├── history/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── ui/                 # Button, Chip, Sheet, Card…
│   │   │   ├── calendar/
│   │   │   ├── orb/                # фирменные сферы
│   │   │   └── layout/             # TabBar, SafeArea, Screen
│   │   ├── lib/
│   │   │   ├── api/                # клиент + Zod-схемы ответов
│   │   │   ├── auth/               # passkey helpers
│   │   │   ├── push/
│   │   │   ├── motion/             # общие variants и transition-пресеты
│   │   │   └── lenis/
│   │   ├── styles/
│   │   └── types/
│   ├── public/
│   │   ├── icons/
│   │   └── manifest.webmanifest
│   ├── tailwind.config.ts
│   └── vite.config.ts
└── api/
    ├── app/
    │   ├── main.py
    │   ├── config.py               # pydantic-settings
    │   ├── db/
    │   │   ├── models/
    │   │   └── session.py
    │   ├── routers/
    │   │   ├── auth.py
    │   │   ├── dates.py
    │   │   ├── invites.py
    │   │   ├── places.py
    │   │   └── push.py
    │   ├── services/
    │   │   ├── webauthn_service.py
    │   │   ├── push_service.py
    │   │   └── places/
    │   │       ├── base.py         # протокол PlacesProvider
    │   │       ├── yandex.py
    │   │       ├── twogis.py
    │   │       ├── kudago.py
    │   │       └── aggregator.py
    │   ├── schemas/
    │   └── cli.py                  # создание пользователей и инвайт-кодов
    ├── alembic/
    └── pyproject.toml
```

**Правило именования экранов:** один экран — одна папка. Компонент, его хуки и
его локальные типы лежат вместе. Общее выносится в `components/ui` только когда
понадобилось в третий раз, не раньше.

---

## 5. Дизайн-система

Собрана из присланных референсов. Основа — тёмная база с размытыми
градиентными сферами (реф. 2 и 4), стеклянные bento-карточки (реф. 1),
плавающий pill-таббар (реф. 4, 5).

### 5.1. Цвет

```ts
// tailwind.config.ts → theme.extend.colors
const colors = {
  void:      '#0B0A0F',  // фон приложения
  surface:   '#16141C',  // карточки
  surface2:  '#201D29',  // вложенные элементы, инпуты
  stroke:    '#2E2A3B',  // границы 1px

  chalk:     '#F2EFF7',  // основной текст
  mist:      '#8E88A0',  // вторичный текст, подписи
  ghost:     '#4A4458',  // отключённое

  ember:     '#FF4D4D',  // сфера пользователя A (муж)
  iris:      '#7B5CFF',  // сфера пользователя B (жена)
  lime:      '#C8FF6A',  // ТОЛЬКО статус «подтверждено»
}
```

**Дисциплина цвета — это важно.** `lime` не используется больше нигде: ни в
кнопках, ни в иконках, ни в ссылках. Он означает ровно одно — свидание
подтверждено. Как только он появится где-то ещё, подтверждение перестанет
читаться мгновенно.

`ember` и `iris` — цвета людей, а не украшение. Карточка свидания, которое
предложил муж, имеет тёплое свечение; предложенное женой — холодное. Отсюда
пользователь понимает авторство до того, как прочитает текст.

### 5.2. Типографика

Все три шрифта имеют кириллицу — это проверено и обязательно.

| Роль | Шрифт | Где |
|---|---|---|
| Display | **Unbounded** (Google Fonts), 500/700, `uppercase`, `tracking-[-0.02em]` | заголовки экранов, крупные даты |
| Body | **Onest** (Google Fonts), 400/500/600 | весь интерфейсный текст |
| Utility | **Martian Mono** (Google Fonts), 400, `uppercase`, `tracking-[0.08em]`, размер 11–12px | подписи, метки осей, таймстемпы, категории |

Шкала:

```
display-xl   40/40   Unbounded 700    — экран приглашения, дата свидания
display-l    28/32   Unbounded 500    — заголовок экрана
title        20/26   Onest 600
body         16/24   Onest 400        — минимум для полей ввода, см. 15.3
caption      13/18   Onest 400
label        11/12   Martian Mono 400
```

Подключать через `@fontsource-variable/*`, не через CDN Google — из РФ CDN
нестабилен, а шрифт, не загрузившийся вовремя, ломает всю сетку.

### 5.3. Форма и материал

```
радиусы:  card 28px · sheet 32px (только верхние углы) · chip 999px · button 999px
сетка:    базовый отступ 4px, шаг сетки 8px, поля экрана 20px
границы:  1px solid stroke, только на стеклянных поверхностях
```

**Стекло** (класс `.glass`):

```css
background: rgba(32, 29, 41, 0.55);
backdrop-filter: blur(24px) saturate(140%);
border: 1px solid rgba(255, 255, 255, 0.06);
```

Внимание: `backdrop-filter` на больших областях роняет FPS на слабых Android.
Применять только к таббару, шапке и bottom sheet. Карточки в списке —
непрозрачный `surface`, без блюра.

### 5.4. Фирменный элемент: сферы

Главный визуальный приём, встречается на всех ключевых экранах.

Технически: `div` с `border-radius: 50%`, залитый `radial-gradient`, поверх
`filter: blur(60px)` и `opacity: 0.7`. **Не картинка и не canvas** — так дешевле
и масштабируется без потерь.

Состояния:

- **Порознь** (главный экран, свиданий нет): две сферы медленно дрейфуют по
  своим орбитам, не пересекаясь. GSAP-таймлайн, бесконечный, `yoyo`.
- **Тянутся** (приглашение отправлено, ответа нет): сферы сближаются и
  пульсируют в противофазе.
- **Слиты** (подтверждено): сферы съезжаются в центр, смешиваются в одну
  фиолетово-алую, внутри неё — обратный отсчёт моно-шрифтом.

Переход между состояниями — GSAP-таймлайн на 1.2s, `power3.inOut`.

### 5.5. Тени

На тёмном фоне обычные тени не видны. Глубина создаётся свечением:

```css
/* приподнятая карточка */
box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -20px rgba(0,0,0,0.8);
/* активный элемент с цветом человека */
box-shadow: 0 0 40px -10px var(--person-color);
```

---

## 6. Экраны и навигация

### 6.1. Карта маршрутов

| Путь | Экран | Доступ |
|---|---|---|
| `/onboarding` | установка PWA, инвайт-код, passkey, push | публичный |
| `/` | Главный (сферы + ближайшее свидание) | защищённый |
| `/create` | Мастер создания, шаги в query: `?step=date` | защищённый |
| `/date/:id` | Карточка свидания | защищённый |
| `/history` | Лента прошедших | защищённый |
| `/settings` | Устройства, уведомления, коды восстановления | защищённый |
| `/i/:token` | Приглашение + опросник | **публичный** |

Защищённые маршруты оборачиваются в `<RequireAuth>`, который при отсутствии
валидной сессии редиректит на `/onboarding`, сохраняя исходный путь в `state`.

### 6.2. Таббар

Плавающий pill внизу, 4 пункта: Главная · Задумать · История · Настройки.
Позиционируется `position: fixed; bottom: calc(16px + env(safe-area-inset-bottom))`.
Центральная кнопка «Задумать» крупнее остальных и подсвечена цветом текущего
пользователя.

Таббар **скрывается** на `/create`, `/i/:token` и при открытом bottom sheet.

---

## 7. Ключевые компоненты

### 7.1. Календарь (`components/calendar`)

Пишется с нуля. Требования:

- Сетка 7×6, недели с понедельника, локаль `ru`.
- Ячейка минимум 44×44px (см. 15.2), внутри — число `Onest 500`.
- Прошедшие даты — `ghost`, не кликабельны.
- День с уже запланированным свиданием помечен точкой цвета того, кто его
  предложил.
- Выбранный день — заливка цветом текущего пользователя, анимация через
  `layoutId="calendar-selection"` (Framer Motion сам сделает перелёт кружка).
- **Свайп между месяцами**: `<motion.div drag="x" dragConstraints>` с
  `onDragEnd`, порог 60px или скорость > 300. Три месяца в DOM одновременно
  (пред/текущий/след), чтобы соседний уже был отрисован.
- Заголовок месяца меняется с вертикальным сдвигом через `AnimatePresence`
  с `mode="popLayout"`.

Важно: подсветка «сегодня» и вычисление прошедших дат делаются в таймзоне
`Europe/Moscow` через `date-fns-tz`, а не через локальную таймзону устройства.
Иначе при поездке приложение начнёт считать дни неправильно.

### 7.2. Пикер времени

Барабан в стиле iOS: два столбца (часы 00–23, минуты с шагом 5), скролл со
snap. Реализация — обычный `overflow-y: scroll` + `scroll-snap-type: y mandatory`,
без библиотек. При остановке скролла — `navigator.vibrate(10)`.

Над барабаном — три чипа-пресета: «Вечером» (19:00), «После работы» (18:30),
«На весь день» (снимает время, ставит флаг `is_all_day`).

### 7.3. Bottom Sheet

Один переиспользуемый компонент. Framer Motion `drag="y"`, закрытие при
`offset.y > 120 || velocity.y > 500`. Фон-подложка `rgba(0,0,0,0.6)` с
`backdrop-blur`. При открытии вызывает `lenis.stop()`, при закрытии —
`lenis.start()`, иначе фон продолжит скроллиться под шторкой.

Обязательно: `body` не скроллится (`overflow: hidden` + компенсация ширины
скроллбара), фокус запирается внутри шторки, `Esc` закрывает.

### 7.4. Карточка места

Показывает: фото (если есть), название, категорию (`label`-стиль), адрес,
расстояние, режим работы со статусом «открыто/закрыто сейчас».
Источник данных помечается маленьким значком — так видно, откуда место.

### 7.5. Карточка свидания

Основная сущность в ленте. Слева вертикальная полоса цвета автора (приём из
реф. 3). Внутри: дата крупным `display`, время, место, записка. Статус —
чипом: `Ждёт ответа` (mist) · `Подтверждено` (lime) · `Прошло` (ghost).

### 7.6. Опросник приглашения

Три шага, каждый — отдельный экран с переходом.

1. «{Имя} зовёт тебя {куда} {когда}. Идём?» → кнопки `Да` / `Нет`
2. «Точно-точно?» → `Конечно` / `Нет`
3. «Последний шанс передумать» → `Иду!` / `Нет`

**Механика кнопки «Нет».** На десктопе она убегает по `onMouseEnter`. На
мобильном события `hover` нет, поэтому убегание вешается на
`onPointerDown` — кнопка успевает сместиться до того, как палец завершит тап,
и `onClick` не срабатывает.

```tsx
const handleEvade = (e: React.PointerEvent) => {
  e.preventDefault();
  setOffset({
    x: (Math.random() - 0.5) * 160,
    y: (Math.random() - 0.5) * 120,
  });
  setEvadeCount((c) => c + 1);
};
```

Кнопка ограничена рамками контейнера, чтобы не улетать за экран. После 4-й
попытки она уменьшается до нуля с `scale` и исчезает совсем — остаётся только
«Да». Это шутка, а не издевательство: после третьего уклонения под кнопкой
появляется подпись «(эта кнопка сломалась)».

При подтверждении — GSAP-таймлайн слияния сфер, `navigator.vibrate([10, 40, 10])`
и переход на экран «Договорились».

---

## 8. Анимации

### 8.1. Разделение зон ответственности

Три библиотеки не должны конфликтовать. Границы такие:

- **Framer Motion** — всё, что связано с React-деревом: появление/исчезновение
  компонентов, переходы между экранами, `layoutId`, жесты (drag, swipe),
  анимация списков со `stagger`.
- **GSAP** — сложные оркестрованные таймлайны, не привязанные к монтированию
  компонентов: дрейф и слияние сфер, отрисовка SVG-путей, конфетти.
- **Lenis** — только инерция скролла. Ничего не анимирует сам.

Правило: **один DOM-узел анимируется только одной библиотекой.** Если GSAP
тянет сферу, Framer Motion её не трогает.

### 8.2. Пресеты (`lib/motion/presets.ts`)

```ts
export const spring = {
  soft:   { type: 'spring', stiffness: 260, damping: 30 },
  snappy: { type: 'spring', stiffness: 400, damping: 34 },
  sheet:  { type: 'spring', stiffness: 300, damping: 32, mass: 0.8 },
} as const;

export const screenVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
} as const;
```

Все переходы экранов используют эти пресеты. Разнобой в тайминге читается как
неаккуратность сильнее, чем отсутствие анимации вообще.

### 8.3. Lenis

Инициализация один раз в корневом layout:

```ts
const lenis = new Lenis({
  duration: 1.1,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  syncTouch: false,   // важно, см. ниже
});
```

**`syncTouch: false` обязателен.** На iOS собственная инерция Safari работает
лучше, чем эмуляция, и попытка её перехватить даёт заметное «залипание» пальца.
Lenis на мобильном оставляем только ради синхронизации с ScrollTrigger.

Связка с GSAP:

```ts
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

При размонтировании — `lenis.destroy()` и `gsap.ticker.remove(...)`, иначе
при навигации накопятся дублирующиеся тикеры и скролл начнёт ускоряться.

### 8.4. Доступность и производительность

- Уважать `prefers-reduced-motion: reduce`: отключить дрейф сфер, заменить
  переходы экранов на `opacity`-фейд 120ms, убрать параллакс.
- Анимировать **только** `transform` и `opacity`. `width`, `height`, `top`,
  `left` в анимациях запрещены — они вызывают layout на каждом кадре.
- `will-change` ставить непосредственно перед анимацией и снимать после.
  Постоянный `will-change` на десятке элементов съедает память GPU.
- Целевой FPS — 60 на iPhone 12 и Redmi Note 11. Проверять через Performance
  в DevTools с CPU throttling 4×.

---

## 9. Аутентификация: passkeys + Face ID

### 9.1. Почему так

Passkey (WebAuthn) хранится в Apple Keychain / Google Password Manager и
разблокируется биометрией. Пароля не существует вовсе — нечего украсть, нечего
подобрать, нечего забыть. Для приложения на двоих это идеальный вариант.

### 9.2. Требования к окружению

- **Только HTTPS.** WebAuthn на `http://` не работает нигде, кроме `localhost`.
- `RP ID` = домен без схемы и порта, например `orbit.example.ru`. Он вшивается
  в passkey навсегда: сменишь домен — все passkey перестанут работать.
- iOS 16+ / Android 9+ / Chrome 108+.
- В standalone-PWA на iOS WebAuthn работает начиная с 17.x. Реализовать
  проверку `window.PublicKeyCredential === undefined` и показать понятную
  ошибку с предложением обновить iOS, а не белый экран.

### 9.3. Создание аккаунтов (bootstrap)

Публичной регистрации нет. Порядок:

```bash
docker compose exec api python -m app.cli create-user \
    --username anton --display-name "Антон" --color ember

docker compose exec api python -m app.cli issue-invite --username anton
# → выводит одноразовый код: 7K2M-9QX4-LP31, живёт 24 часа
```

Пользователь вводит этот код на онбординге — это единственный способ привязать
первый passkey.

### 9.4. Регистрация passkey

```
POST /api/auth/register/options   { invite_code }
  → сервер валидирует код, отдаёт PublicKeyCredentialCreationOptions
    authenticatorSelection: {
      authenticatorAttachment: 'platform',   // встроенная биометрия
      residentKey: 'required',               // discoverable credential
      userVerification: 'required',          // принудительный Face ID
    }
    challenge живёт в Redis 5 минут, ключ = invite_code

POST /api/auth/register/verify    { credential }
  → py_webauthn.verify_registration_response
  → сохраняем credential_id, public_key, sign_count, transports
  → инвайт-код помечается использованным
  → выдаём сессию + 10 кодов восстановления (показываются один раз)
```

`residentKey: 'required'` даёт вход **без ввода логина**: пользователь просто
жмёт «Войти», система сама предлагает нужный passkey.

### 9.5. Вход

```
POST /api/auth/login/options   {}                → challenge, allowCredentials: []
POST /api/auth/login/verify    { credential }    → сессия
```

`allowCredentials: []` — намеренно пустой массив: это и включает
usernameless-вход через discoverable credentials.

**Обязательно проверять `sign_count`.** Если пришедший счётчик не больше
сохранённого — это признак клонированного ключа, вход отклоняется, запись
пишется в лог. Для passkey из iCloud Keychain счётчик всегда `0` — этот случай
обрабатывается отдельно как валидный.

### 9.6. Сессия

- **Access-токен**: JWT, 15 минут, живёт в памяти JS (не в `localStorage`).
- **Refresh-токен**: httpOnly + Secure + SameSite=Lax cookie, 90 дней,
  ротируется при каждом обновлении. Старый токен инвалидируется; повторное
  использование отозванного токена отзывает всю цепочку (защита от кражи).
- Тихое обновление через интерсептор в API-клиенте: на `401` — один запрос
  `/api/auth/refresh`, затем повтор исходного. Параллельные 401 объединяются в
  один refresh через промис-синглтон.

### 9.7. Восстановление и второе устройство

- **Добавить устройство**: в настройках → «Добавить устройство» → генерируется
  инвайт-код на 10 минут → вводится на новом телефоне → новый passkey
  привязывается к тому же пользователю. Устройств может быть сколько угодно.
- **Потеряны все устройства**: вход по коду восстановления (одному из 10).
  Код одноразовый, хранится как хэш Argon2id. После входа обязательное
  создание нового passkey.
- В настройках — список привязанных устройств с датой создания и последним
  входом, с возможностью отозвать любое.

---

## 10. Модель данных

```sql
CREATE TYPE user_color AS ENUM ('ember', 'iris');
CREATE TYPE date_status AS ENUM
  ('draft', 'pending', 'confirmed', 'declined', 'cancelled', 'done');
CREATE TYPE place_source AS ENUM ('yandex', 'twogis', 'kudago', 'custom');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  color         user_color NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE credentials (            -- passkeys
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id  bytea UNIQUE NOT NULL,
  public_key     bytea NOT NULL,
  sign_count     bigint NOT NULL DEFAULT 0,
  transports     text[],
  device_label   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz
);

CREATE TABLE recovery_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  used_at    timestamptz
);

CREATE TABLE invite_codes (           -- bootstrap и добавление устройств
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE dates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid NOT NULL REFERENCES users(id),
  guest_id       uuid NOT NULL REFERENCES users(id),
  status         date_status NOT NULL DEFAULT 'draft',
  scheduled_at   timestamptz NOT NULL,
  is_all_day     boolean NOT NULL DEFAULT false,
  note           text CHECK (char_length(note) <= 280),

  -- СНИМОК места, а не ссылка. См. 12.5
  place_source     place_source NOT NULL,
  place_external_id text,
  place_name       text NOT NULL,
  place_category   text,
  place_address    text,
  place_lat        double precision,
  place_lon        double precision,
  place_photo_url  text,
  place_payload    jsonb,          -- сырой ответ провайдера на момент выбора

  created_at     timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dates_scheduled ON dates (scheduled_at DESC);

CREATE TABLE invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_id       uuid NOT NULL REFERENCES dates(id) ON DELETE CASCADE,
  token         text UNIQUE NOT NULL,
  expires_at    timestamptz NOT NULL,
  opened_at     timestamptz,
  responded_at  timestamptz,
  evade_count   integer NOT NULL DEFAULT 0   -- сколько раз убегала кнопка :)
);

CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text UNIQUE NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  failed_at   timestamptz
);

CREATE TABLE custom_places (          -- «наши места»
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  uuid NOT NULL REFERENCES users(id),
  name        text NOT NULL,
  category    text,
  address     text,
  lat         double precision,
  lon         double precision,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE places_cache (
  cache_key   text PRIMARY KEY,       -- sha256(provider + normalized_query)
  payload     jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
```

**Про время.** Всё хранится в `timestamptz` (UTC). Отображается всегда в
`Europe/Moscow`. Никаких naive-datetime в коде — `datetime.now(timezone.utc)`,
не `datetime.now()`.

---

## 11. Контракт API

Базовый префикс `/api`. Все ответы — JSON. Ошибки в едином формате:

```json
{ "error": { "code": "INVITE_EXPIRED", "message": "Приглашение истекло" } }
```

Коды HTTP используются по назначению: 400 — невалидные данные, 401 — нет
сессии, 403 — нет прав, 404 — не найдено, 409 — конфликт состояния,
429 — превышен лимит.

### Аутентификация

| Метод | Путь | Тело | Ответ |
|---|---|---|---|
| POST | `/auth/register/options` | `{invite_code}` | `PublicKeyCredentialCreationOptions` |
| POST | `/auth/register/verify` | `{credential}` | `{user, recovery_codes[]}` |
| POST | `/auth/login/options` | — | `PublicKeyCredentialRequestOptions` |
| POST | `/auth/login/verify` | `{credential}` | `{access_token, user}` + refresh-cookie |
| POST | `/auth/refresh` | — (cookie) | `{access_token}` |
| POST | `/auth/logout` | — | `204` |
| POST | `/auth/recovery` | `{code}` | `{access_token, user}` |
| GET | `/auth/devices` | — | `Credential[]` |
| DELETE | `/auth/devices/{id}` | — | `204` |
| POST | `/auth/devices/invite` | — | `{code, expires_at}` |

### Свидания

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/dates?status=&limit=&cursor=` | курсорная пагинация по `scheduled_at` |
| GET | `/dates/upcoming` | ближайшее подтверждённое, для главного экрана |
| POST | `/dates` | создаёт в статусе `draft` |
| PATCH | `/dates/{id}` | правка черновика; после `pending` — только `note` |
| POST | `/dates/{id}/send` | `draft` → `pending`, создаёт invite, отдаёт ссылку |
| POST | `/dates/{id}/cancel` | любой статус → `cancelled`, push второму |
| DELETE | `/dates/{id}` | только `draft` |

### Приглашения (публичные)

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/invites/{token}` | данные свидания без ID пользователей; ставит `opened_at` |
| POST | `/invites/{token}/respond` | `{accepted: true, evade_count}` → `confirmed`, push автору |

Rate limit на публичные эндпоинты: 20 запросов в минуту на IP.

### Места

| Метод | Путь | Комментарий |
|---|---|---|
| GET | `/places/search?q=&category=&lat=&lon=&radius=` | агрегированная выдача |
| GET | `/places/{source}/{external_id}` | детали |
| GET | `/places/categories` | справочник категорий |
| GET | `/places/custom` · POST · DELETE | «наши места» |

### Push

| Метод | Путь |
|---|---|
| GET | `/push/vapid-public-key` |
| POST | `/push/subscribe` |
| POST | `/push/unsubscribe` |
| POST | `/push/test` |

---

## 12. Источники данных о местах

Одного API недостаточно: справочники организаций отдают **заведения**, но не
отдают **события с датами**. Поэтому источников три, и они сводятся в одну
выдачу.

### 12.1. Три источника

**A. Яндекс — Поиск по организациям** (основной)
`https://search-maps.yandex.ru/v1/?apikey=…&text=…&type=biz&lang=ru_RU&results=50`
Отдаёт: название, адрес, координаты, рубрики, телефон, часы работы, сайт.
Ключ бесплатный, лимит порядка 500 запросов в сутки — для двух человек с
запасом. Регистрация в Яндекс Кабинете Разработчика.
Покрывает: рестораны, кафе, бары, кино, боулинг, спа, парки.

**B. 2ГИС — Catalog API** (дополняющий)
`https://catalog.api.2gis.com/3.0/items?q=…&key=…&fields=items.point,items.rubrics,items.schedule`
Детальнее Яндекса по фотографиям и рубрикатору, но ключ выдают по заявке.
Включается через фича-флаг: если ключа в `.env` нет — провайдер просто
не участвует в агрегации, приложение работает.

**C. KudaGo** (события)
`https://kudago.com/public-api/v1.4/events/?location=msk&categories=exhibition&actual_since=…`
**Ключ не нужен вообще**, публичный открытый API. Отдаёт события с датами
проведения: выставки, спектакли, концерты, фестивали, лекции.
Это и есть решение проблемы выставок — именно здесь у события есть дата, а
не только адрес здания.
Города: `msk`, `spb`, `ekb`, `nsk`, `kzn` и другие.

**D. Custom** — таблица `custom_places`. Для того, чего нет нигде: «наша
скамейка на набережной», «дома с пиццей», квартира друзей.

### 12.2. Абстракция провайдера

```python
# app/services/places/base.py
from typing import Protocol
from app.schemas.places import PlaceDTO, PlaceQuery

class PlacesProvider(Protocol):
    source: PlaceSource
    async def search(self, query: PlaceQuery) -> list[PlaceDTO]: ...
    async def details(self, external_id: str) -> PlaceDTO | None: ...
    def is_enabled(self) -> bool: ...
```

Каждый провайдер нормализует свой ответ в единый `PlaceDTO`:

```python
class PlaceDTO(BaseModel):
    source: PlaceSource
    external_id: str
    name: str
    category: str          # уже маппленная внутренняя категория
    address: str | None
    lat: float | None
    lon: float | None
    photo_url: str | None
    schedule: Schedule | None
    event_dates: list[date] | None   # только для KudaGo
    url: str | None
    raw: dict                        # сырой ответ, для отладки
```

**Фронтенд никогда не видит различий между провайдерами** — он получает
одинаковые объекты. Это позволит потом добавить или убрать источник, не трогая
UI вообще.

### 12.3. Агрегатор

`aggregator.py` опрашивает включённые провайдеры **параллельно** через
`asyncio.gather(..., return_exceptions=True)`.

Правила:
- Таймаут на провайдера — 3 секунды. Не ответил — выпадает из выдачи, но
  остальные результаты отдаются. Падение одного источника не ломает поиск.
- Дедупликация: два места считаются одним, если расстояние между координатами
  < 50 метров **и** нормализованные названия совпадают (нижний регистр, без
  пунктуации, расстояние Левенштейна ≤ 2). Побеждает запись с более полными
  данными.
- Сортировка: сначала `custom` (свои места всегда наверху), затем по
  расстоянию от переданных координат, затем по полноте карточки.

### 12.4. Кэш

Два уровня:

1. **Redis**, ключ `places:{provider}:{sha256(normalized_query)}`, TTL 6 часов —
   для повторных запросов внутри сессии.
2. **PostgreSQL `places_cache`**, TTL 7 дней — переживает перезапуск Redis и
   служит аварийным источником, если внешний API недоступен: при ошибке
   провайдера отдаём просроченный кэш с флагом `stale: true`, фронт показывает
   ненавязчивую подпись «данные могли устареть».

Нормализация запроса перед хэшированием: `strip`, нижний регистр, схлопывание
пробелов, округление координат до 3 знаков (~100 м). Без этого кэш не будет
попадать почти никогда.

### 12.5. Снимок при выборе — обязательно

Когда место прикрепляется к свиданию, его поля **копируются** в строку `dates`,
а не хранятся ссылкой на внешний ID.

Причина: ресторан закроется, KudaGo удалит прошедшее событие, провайдер сменит
структуру ответа — и вся история свиданий превратится в список «место не
найдено». Снимок делает запись о свидании самодостаточной навсегда.

### 12.6. Безопасность ключей

Ключи Яндекса и 2ГИС живут **только** в `.env` бэкенда. В коде фронтенда их
быть не может ни при каких условиях: Vite подставляет `VITE_*` переменные прямо
в бандл, и любой ключ оттуда извлекается за 10 секунд через DevTools.

Все обращения к внешним API идут исключительно через `/api/places/*`.

### 12.7. Категории

Внутренний справочник, к которому маппятся рубрики всех провайдеров:

```
Поесть · Кофе · Бар · Кино · Выставка · Театр · Концерт
Прогулка · Активность · Спа · Дома · Другое
```

Маппинг лежит в `app/services/places/categories.py` отдельным словарём.
Рубрика, которую не удалось смапить, попадает в «Другое», но при этом пишется
в лог — так постепенно словарь дополняется.

### 12.8. Ограничение MVP

Справочники организаций не знают про афишу. «Выставка» из Яндекса — это здание
музея, а не конкретная экспозиция с датами. Реальные события с датами приходят
**только из KudaGo** и **только по крупным городам**. Это принято и не
считается дефектом.

---

## 13. Web Push

### 13.1. Схема

Своя реализация на VAPID. Firebase не нужен: `pywebpush` шлёт напрямую в
push-сервисы браузеров.

Генерация ключей один раз:
```bash
python -c "from py_vapid import Vapid01; v=Vapid01(); v.generate_keys(); v.save_key('private.pem')"
```
Публичный ключ отдаётся фронту через `/api/push/vapid-public-key` — он не
секретный. Приватный лежит в `.env` бэкенда.

### 13.2. Подписка на фронте

Критично соблюсти порядок:

```ts
// 1. Только в standalone. В обычной вкладке iOS подписка не создастся вовсе.
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;
if (!isStandalone) return showInstallInstructions();

// 2. Разрешение запрашивается ТОЛЬКО по тапу пользователя.
//    Вызов при загрузке страницы Safari молча отклоняет.
const permission = await Notification.requestPermission();
if (permission !== 'granted') return;

// 3. Подписка
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,                       // обязателен, иначе ошибка
  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
});

await api.post('/push/subscribe', sub.toJSON());
```

`applicationServerKey` принимает `Uint8Array`, а ключ приходит как
base64url-строка. Функция `urlBase64ToUint8Array` обязательна — без неё будет
`InvalidCharacterError`.

### 13.3. Service Worker

```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url },
      vibrate: [12, 40, 12],
      tag: data.tag,          // склеивает повторные уведомления
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data.url;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        const open = list.find((c) => c.url.includes(self.location.origin));
        if (open) return open.focus().then(() => open.navigate(url));
        return clients.openWindow(url);
      })
  );
});
```

`event.waitUntil` обязателен: без него SW уснёт до показа уведомления.

### 13.4. Отправка с бэкенда

Через `BackgroundTasks`, чтобы ответ API не ждал push-сервисы.

Обработка ответов:
- `201`/`200` — доставлено в сервис;
- `404`/`410` — подписка мертва, **удалить строку из БД**;
- `429` — уважить `Retry-After`;
- `413` — payload больше 4 КБ, урезать.

Уведомления шлются на все подписки пользователя (телефон + ноутбук).

### 13.5. События уведомлений

| Событие | Кому | Текст |
|---|---|---|
| Приглашение отправлено | гостю | «{Имя} что-то задумал(а)» |
| Приглашение открыто | автору | «{Имя} читает твоё приглашение» |
| Подтверждено | автору | «Свидание подтверждено · {дата}» |
| За сутки | обоим | «Завтра в {время} — {место}» |
| За 2 часа | обоим | «Через 2 часа. {место}» |

Напоминания — APScheduler, задача раз в 15 минут выбирает подходящие свидания.
Дедупликация через поле `reminded_24h` / `reminded_2h` в таблице `dates`,
иначе при рестарте напоминания продублируются.

### 13.6. Честные ограничения

- **iOS**: только 16.4+, только установленное на домашний экран приложение.
  В браузерной вкладке push не будет никогда.
- Если пользователь удалит иконку с домашнего экрана — подписка умрёт,
  придётся выдавать заново.
- Доставка не гарантирована и не мгновенна. Поэтому внутри приложения всегда
  есть свой список уведомлений — push это удобство, а не единственный канал.

---

## 14. PWA

### 14.1. Манифест

```json
{
  "name": "Orbit",
  "short_name": "Orbit",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0B0A0F",
  "theme_color": "#0B0A0F",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512",
      "type": "image/png", "purpose": "maskable" }
  ]
}
```

`maskable`-иконка обязательна, иначе на Android иконку обрежут по кругу и
срежет края. Значимое содержимое должно помещаться в центральные 80%.

Для iOS дополнительно в `index.html`:

```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Orbit">
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover">
```

Иконка на домашнем экране: сфера на почти-чёрном фоне — тот же фирменный
элемент, что и в приложении.

### 14.2. Кэширование (Workbox)

| Ресурс | Стратегия |
|---|---|
| App shell (JS/CSS/HTML) | Precache, `cleanupOutdatedCaches` |
| Шрифты | CacheFirst, 1 год |
| Фото мест | CacheFirst, 30 дней, максимум 60 записей |
| `GET /api/dates*` | NetworkFirst, таймаут 3с, фолбэк на кэш |
| `GET /api/places*` | NetworkFirst, таймаут 3с |
| Любые POST/PATCH/DELETE | **не кэшировать** |

`registerType: 'prompt'` — при выходе новой версии показывать аккуратную
плашку «Доступно обновление» с кнопкой, а не перезагружать экран под руками.

### 14.3. Офлайн

Минимальный, но осмысленный: последние загруженные свидания читаются из кэша.
Экран офлайна — не браузерная ошибка, а свой: сферы замирают, подпись «Нет
связи. Показываю, что помню».

Создание свидания офлайн не поддерживается — кнопка блокируется с пояснением.

---

## 15. Мобильные требования

Это приоритетная платформа, требования жёсткие.

### 15.1. Безопасные зоны

```css
.screen {
  padding-top:    max(20px, env(safe-area-inset-top));
  padding-bottom: max(20px, env(safe-area-inset-bottom));
}
```
Без `viewport-fit=cover` в meta переменные `env()` вернут ноль.

### 15.2. Зоны нажатия

Минимум **44×44px** для любого интерактивного элемента. Если визуально элемент
меньше — расширяется невидимой областью через псевдоэлемент, а не увеличением
самой иконки.

### 15.3. Высота и ввод

- `100dvh` вместо `100vh`. `100vh` на iOS не учитывает адресную строку и даёт
  скачок при скролле.
- `font-size` полей ввода **не меньше 16px**, иначе Safari зумит страницу при
  фокусе, и вернуть масштаб уже нельзя.
- `touch-action: manipulation` на кнопках — убирает задержку 300ms.
- `-webkit-tap-highlight-color: transparent` — серый прямоугольник при тапе
  выглядит как сайт, а не приложение.
- `overscroll-behavior-y: contain` на корне — блокирует pull-to-refresh,
  который в standalone-режиме ломает ощущение приложения.

### 15.4. Тактильный отклик

`navigator.vibrate()` там, где нативное приложение дало бы haptic: выбор даты
(10ms), остановка барабана времени (10ms), отправка приглашения (30ms),
подтверждение (`[10,40,10]`). На iOS API не поддерживается — вызов просто
ничего не сделает, обёртку писать не надо, но и полагаться на вибрацию как на
единственный отклик нельзя.

### 15.5. Производительность

- LCP < 2.0s на 4G, TTI < 3.0s.
- Начальный JS-бандл < 200 КБ gzip. GSAP подгружается динамическим импортом
  только на экранах со сферами.
- Изображения мест — `loading="lazy"`, `decoding="async"`, фиксированные
  `width`/`height` для предотвращения сдвигов вёрстки.

---

## 16. Безопасность

- HTTPS обязателен (иначе не работают ни passkey, ни SW, ни push).
- HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- CSP без `unsafe-eval`. `unsafe-inline` для стилей допустим из-за Tailwind,
  для скриптов — нет.
- CORS: единственный разрешённый origin — продакшн-домен. Никаких `*`.
- Токены приглашений: `secrets.token_urlsafe(24)`, срок жизни 7 дней.
  При открытии ссылки не раскрывать ID пользователей — только отображаемые имена.
- Rate limit: 5 попыток входа в минуту на IP, 20 запросов в минуту на публичные
  эндпоинты приглашений.
- Логи не содержат токенов, `credential_id` и содержимого записок.
- `POST`-эндпоинты, меняющие состояние, требуют заголовок `X-Requested-With`
  (простая защита от CSRF в дополнение к `SameSite=Lax`).

---

## 17. Развёртывание

VPS в РФ (Timeweb Cloud / Selectel), 2 vCPU / 2 ГБ RAM достаточно.

```
nginx (443, TLS)
  ├── /            → статика web/dist
  └── /api         → uvicorn:8000
postgres:16
redis:7
```

- TLS — Let's Encrypt через certbot, автопродление в cron.
- `docker-compose.prod.yml`, образы собираются локально или в CI.
- Бэкап Postgres: `pg_dump` ежедневно, 14 копий, храним вне сервера.
- В Nginx: `gzip`/`brotli`, `Cache-Control: immutable` на хэшированные ассеты,
  `no-cache` на `index.html` и `sw.js` (иначе обновления не доедут).
- `.env.example` содержит все переменные с комментариями, реальный `.env`
  в git не попадает.

Переменные окружения:
```
DATABASE_URL, REDIS_URL, JWT_SECRET, RP_ID, RP_NAME, ORIGIN,
VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT,
YANDEX_PLACES_API_KEY, TWOGIS_API_KEY (опционально),
KUDAGO_CITY, TIMEZONE=Europe/Moscow
```

---

## 18. Фазы реализации

Каждая фаза завершается работающим приложением, а не «половиной слоя».

**Фаза 1 — фундамент.**
Docker Compose, FastAPI + Postgres + Alembic, Vite + React + Tailwind с
подключёнными шрифтами и токенами из раздела 5, базовый layout с таббаром,
роутинг, экран-заглушка. Проверка: `docker compose up` поднимает всё одной
командой.

**Фаза 2 — аутентификация.**
CLI создания пользователей и инвайт-кодов, WebAuthn регистрация и вход, сессии
с ротацией refresh, коды восстановления, экран настроек с устройствами.
Проверка: вход по Face ID на реальном iPhone, а не в эмуляторе.

**Фаза 3 — PWA-оболочка.**
Манифест, иконки, Service Worker, экран онбординга с детекцией standalone и
инструкцией установки. Проверка: иконка на домашнем экране, запуск без
адресной строки.

**Фаза 4 — свидания и календарь.**
Модель `dates`, CRUD, самописный календарь со свайпом, пикер времени, мастер
создания, главный экран, лента истории. Места на этой фазе — только `custom`.

**Фаза 5 — места.**
Провайдеры Яндекс + KudaGo, агрегатор, кэш, поиск с фильтрами, детали места,
«наши места». 2ГИС — опционально, если получен ключ.

**Фаза 6 — приглашения.**
Генерация токена, публичный экран `/i/:token`, опросник с убегающей кнопкой,
share-sheet, смена статусов.

**Фаза 7 — уведомления.**
VAPID, подписка, отправка, обработка мёртвых подписок, APScheduler для
напоминаний, внутренний список уведомлений.

**Фаза 8 — сферы и полировка.**
GSAP-таймлайны трёх состояний сферы, переходы экранов, Lenis, `stagger` в
списках, `prefers-reduced-motion`, вибрация, офлайн-экран, профилирование
на реальных устройствах.

---

## 19. Критерии приёмки

Функциональные:

- [ ] Приложение ставится на домашний экран на iOS и Android и запускается
      в полноэкранном режиме.
- [ ] Вход происходит по Face ID / Touch ID, пароля не существует.
- [ ] Второе устройство добавляется через код из настроек.
- [ ] Потеря всех устройств решается кодом восстановления.
- [ ] Свидание создаётся за 4 шага, календарь листается свайпом.
- [ ] Поиск мест возвращает результаты минимум из двух источников,
      выставки приходят с датами.
- [ ] Падение внешнего API не ломает поиск — отдаётся кэш с пометкой.
- [ ] Ссылка-приглашение открывается на устройстве без сессии.
- [ ] Кнопка «Нет» не нажимается пальцем на реальном телефоне.
- [ ] После подтверждения приходит push на второе устройство.
- [ ] Данные о выбранном месте сохраняются в свидании и не пропадают, если
      место исчезло у провайдера.

Качественные:

- [ ] `tsc --noEmit` и `mypy --strict` проходят без ошибок.
- [ ] В коде нет `any` и нет закомментированных блоков.
- [ ] 60 FPS на анимациях при CPU throttling 4×.
- [ ] LCP < 2.0s на эмуляции 4G.
- [ ] `prefers-reduced-motion` действительно отключает анимации.
- [ ] Все интерактивные элементы не меньше 44×44px.
- [ ] Ключи внешних API отсутствуют в собранном бандле
      (проверить `grep` по `dist/`).

---

## 20. Вне scope

Не делать, даже если покажется уместным:

- Регистрация, восстановление по email, соцсети.
- Telegram в любом виде.
- Больше двух пользователей, роли, права.
- Оплата, бронирование столиков, интеграции с заведениями.
- Комментарии, чат, лайки.
- Веб-версия для десктопа как самостоятельный продукт (должно не разваливаться
  на широком экране — этого достаточно).
- Аналитика, трекеры, сторонние скрипты. Приложение приватное.

---

## 21. Вопросы, которые нужно задать до старта

Если что-то из этого не определено — не додумывать, а спросить:

1. Домен для продакшна (он вшивается в passkey навсегда).
2. Город для KudaGo (`msk`, `spb`, …).
3. Имена и цвета двух пользователей.
4. Получен ли ключ 2ГИС — от этого зависит, включать ли провайдера.
5. Нужен ли экспорт свидания в календарь телефона (`.ics`) — в текущее ТЗ
   не входит.
