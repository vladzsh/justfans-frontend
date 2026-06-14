# Автоматизированный e2e тест-план

## Цель

Набор Playwright-тестов (Chromium) проверяет ключевые пользовательские сценарии
JustFans CRM в реальном браузере против живого стека (nginx → Django ASGI + Redis + Postgres).

---

## Предварительные требования

| Требование | Значение |
|---|---|
| Стек запущен | `cd backend && FRONTEND_CONTEXT=../frontend docker compose up --build` |
| Данные засеяны | `docker compose exec backend python manage.py seed` |
| Пороги времени | `OVERDUE_SECONDS=10`, `PRESENCE_GRACE_SECONDS=15`, `HEARTBEAT_SECONDS=5` |
| Браузер | Playwright Chromium (устанавливается один раз командой `npx playwright install chromium`) |
| URL | `http://localhost:8080` |
| Демо-аккаунты | `chatter1`–`chatter4`, `teamlead1`, пароль `demo1234` |

---

## Команды запуска

```bash
# Полный прогон
npm run test:e2e

# Один конкретный файл
npx playwright test e2e/auth.spec.ts

# С визуальным браузером (для отладки)
npx playwright test --headed

# С отчётом в HTML
npx playwright test --reporter=html && npx playwright show-report
```

---

## Структура суита

### `e2e/auth.spec.ts` — Аутентификация

Покрывает сценарий **AUTH** из спецификации.

| Тест | Что проверяет | Сценарий |
|---|---|---|
| teamlead login → monitor | Тимлид попадает на `/monitor`, виден `kpi-bar` | AUTH-1 |
| chatter1 login → chat | Чатер попадает на `/chat`, виден `chat-layout` | AUTH-2 |
| logout → /login | Кнопка «Выйти» сбрасывает сессию и редиректит | AUTH-3 |
| invalid credentials | `p.login-error` с текстом ошибки, URL остаётся `/login` | AUTH-4 |

### `e2e/monitor.spec.ts` — Монитор тимлида

Покрывает сценарий **MONITOR** из спецификации.

| Тест | Что проверяет | Сценарий |
|---|---|---|
| KPI bar | Все 4 чипа (Диалогов / Ждут / Просрочено / Онлайн) видны, значения содержат цифры | MON-1 |
| Аналитика tab | URL `/monitor/analytics`, `.charts-section` и `<canvas>` видны | MON-2 |
| Чатеры tab | URL `/monitor/chatters`, таблица с хотя бы одной строкой | MON-3 |
| Очередь tab | URL `/monitor/queue`, список строк `.queue-row` виден | MON-4 |
| ПРОСРОЧЕНО badge | Засеянный диалог Jake→chatter3 сразу показывает `.status-badge--overdue` | MON-5 |

### `e2e/realtime.spec.ts` — Реалтайм WS-пайплайн (флагманский тест)

Покрывает сценарий **REALTIME** из спецификации.

| Шаг | Действие | Ожидаемый результат |
|---|---|---|
| 1 | Логин тимлида, переход на `/monitor/queue` | WS-индикатор «Онлайн» |
| 2 | `GET /api/monitor/snapshot/` | Находим диалог с `awaiting_reply_since = null` (статус OK) |
| 3 | `POST /api/demo/fan-message/` с `conversation_id` | HTTP 201 |
| 4 | Без `page.reload()` — ждём WS-пуш | Бейдж `.status-badge--unanswered` («без ответа») появляется в течение 8 с |
| 5 | Ждём клиентский тикер (`overdue_seconds=10 с`) | Бейдж `.status-badge--overdue` («просрочено») флипается за 15 с |

Тест доказывает, что:
- `monitor.update` приходит по WS без перезагрузки страницы
- `useTicker.ts` пересчитывает статус на клиенте без серверного события

---

## Ключевые технические детали

- **CSRF**: заголовок `X-CSRFToken` извлекается из cookie браузера через `context.cookies()` — точно так же, как делает `src/services/api.ts`.
- **Cookie-sharing**: `page.request` разделяет jar с браузерным контекстом, поэтому сессионная cookie `sessionid` передаётся автоматически.
- **Селекторы**: CSS-классы компонентов (`kpi-bar`, `queue-row`, `status-badge--overdue` и т. д.) — не data-testid, что проверяет реальный рендеринг Vue.
- **Таймауты**: `expect timeout` по умолчанию 8 с; для перехода в ПРОСРОЧЕНО используется `{ timeout: 15000 }` (overdue=10 с + буфер на тикер).
- **Воспроизводимость**: тест находит «ok»-диалог динамически через snapshot API, а не хардкодит ID — что делает его устойчивым к ресиду.
