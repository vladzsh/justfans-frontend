# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Frontend of the JustFans mini-CRM test task: Vue 3 (Composition API, `<script setup>`, TypeScript) + Pinia + Vue Router, built with Vite. Russian-language UI, plain scoped CSS (no UI libs). The OpenSpec repo (`vladzsh/justfans-spec`, locally `../openspec`) is normative for REST payloads and WS events — `src/types/contracts.ts` mirrors them and must stay in sync with the spec, not the other way around.

## Commands

```bash
npm run dev          # Vite dev server; proxies /api and /ws to http://localhost:8000
npm run test -- --run                       # Vitest (all)
npm run test -- --run src/__tests__/messages.test.ts   # single file
npm run build        # vue-tsc + vite build (must stay clean)
```

For a full running app use docker compose from the backend repo (`FRONTEND_CONTEXT=../frontend docker compose up --build` → :8080). `nginx.conf` + `Dockerfile` here produce the production container: static SPA + proxy of `/api`/`/ws` to `${BACKEND_HOST}:8000` (envsubst substitutes **only** `BACKEND_HOST` — adding other `$vars` to nginx.conf is safe, adding them to the envsubst list will silently break nginx runtime vars).

## Architecture

- **`src/services/ws.ts`** — singleton WS client: exponential backoff + jitter reconnect, heartbeat `ping` every `heartbeat_seconds` (from `/api/config/`), event dispatch to stores. Dispatches `connected` with `isReconnect`; resync (`GET /api/sync/?after_id=`) and `resendPending()` run **only on reconnect**, never on first connect. Liveness: a short pong-deadline (`min(heartbeat,4)s`) → `handleDeadConnection()` (detach handlers + close proactively — never await a graceful `onclose`, it hangs against a frozen peer); `window 'online'` forces an immediate reconnect.
- **Stores own the protocol logic, components only render.** `messages.ts`: optimistic send keyed by `client_msg_id` (confirm via `message.new` echo), dedup-by-`id` merge for resync and pagination, `markFailed`/`retryMessage` for WS `error` events (failed messages are excluded from auto-resend). `conversations.ts`: unread counters, previews, ordering. `monitor.ts`: snapshot + `monitor.update` merge.
- **Time-derived UI states are computed client-side** with the reactive ticker (`composables/useTicker.ts`): overdue = `now - waiting_since > overdue_seconds`, offline = not connected and `now - last_seen > presence_grace_seconds`. Thresholds always come from `/api/config/` — never hardcode.
- Store logic must stay framework-pure enough to test in Vitest without mounting components (`src/__tests__/` covers dedup, ordering, unread, overdue/offline math, first-connect-vs-reconnect).

## Conventions

Conventional Commits in English, one logical change per commit, never mention AI in commits, no `Co-Authored-By`, no `--amend` (history is graded by the jury). Component/file names in English, UI strings in Russian. `.explore/` is gitignored scratch space for throwaway e2e scripts — never commit its contents.

**Testing WS drops:** Playwright `context.setOffline()` does NOT sever an already-open WS to localhost; emulate a *silent* drop with `docker compose pause backend` (a clean close is `docker compose stop` — different code path). Real Chrome DevTools → Offline does fire `window` `online`/`offline`. Verify reconnect/presence fixes against the live Docker stack, not just green unit tests.
