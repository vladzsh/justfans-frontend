# JustFans Frontend

Vue 3 + Pinia SPA для мини-CRM чатеров. В production собирается в Docker-образ и отдаётся через nginx (который также проксирует `/api` и `/ws`).

- Backend-репо: [github.com/vladzsh/justfans-backend](https://github.com/vladzsh/justfans-backend)
- Спецификация: [github.com/vladzsh/justfans-spec](https://github.com/vladzsh/justfans-spec)

---

## Dev-запуск

Нужен запущенный backend на `http://localhost:8000`.

```bash
npm install
npm run dev
```

Vite автоматически проксирует `/api` и `/ws` на `http://localhost:8000`.

---

## Тесты

```bash
npm run test
```
