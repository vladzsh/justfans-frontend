import { test, expect } from '@playwright/test'

/**
 * Flagship realtime test: proves the WebSocket monitor.update event pipeline works
 * end-to-end without a page reload.
 *
 * Flow:
 *  1. Login as teamlead → /monitor/queue
 *  2. Fetch snapshot to identify an "ok" conversation (awaiting_reply_since == null)
 *  3. POST /api/demo/fan-message/ with that conversation_id
 *     → backend sets awaiting_reply_since, emits monitor.update over WS
 *  4. Assert: "без ответа" badge for that dialog appears LIVE (no reload)
 *  5. Assert: after overdue_seconds (10 s), badge flips to "просрочено" client-side
 */
test('realtime: fan message → appears live as «без ответа» then auto-flips to «просрочено»', async ({
  page,
  context,
}) => {
  // ── Step 1: Login as teamlead ──────────────────────────────────────────────
  await page.goto('/login')
  await page.fill('#username', 'teamlead1')
  await page.fill('#password', 'demo1234')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/monitor/)

  // Navigate to the Queue tab (also the default, but be explicit)
  await page.click('a.monitor-tab:has-text("Очередь")')
  await expect(page).toHaveURL(/\/monitor\/queue/)
  await expect(page.locator('.queue-wrap')).toBeVisible()

  // Wait for the WS connection to go live before we act
  await expect(page.locator('.ws-indicator--connected')).toBeVisible({ timeout: 10000 })

  // ── Step 2: Find an "ok" conversation via the monitor snapshot ─────────────
  // GET /api/monitor/snapshot/ — authenticated via shared session cookie
  const snapshotResp = await page.request.get('/api/monitor/snapshot/')
  expect(snapshotResp.ok()).toBeTruthy()
  const snapshot: {
    chatters: Array<{
      id: number
      display_name: string
      dialogs: Array<{
        conversation_id: number
        fan_name: string
        awaiting_reply_since: string | null
      }>
    }>
  } = await snapshotResp.json()

  let targetConvId: number | null = null
  let targetFanName = ''
  let targetChatterName = ''

  outer: for (const chatter of snapshot.chatters) {
    for (const dialog of chatter.dialogs) {
      if (dialog.awaiting_reply_since === null) {
        targetConvId = dialog.conversation_id
        targetFanName = dialog.fan_name
        targetChatterName = chatter.display_name
        break outer
      }
    }
  }

  // Seeded data always has "ok" dialogs; fail fast if the seed is broken
  expect(targetConvId, 'No "ok" conversation found in snapshot — check seed data').not.toBeNull()

  // ── Step 3: POST fan message to that conversation ──────────────────────────
  // Read the csrftoken cookie so we can pass it as X-CSRFToken
  const cookies = await context.cookies('http://localhost:8080')
  const csrfToken = cookies.find((c) => c.name === 'csrftoken')?.value ?? ''

  const fanMsgResp = await page.request.post('/api/demo/fan-message/', {
    headers: {
      'X-CSRFToken': csrfToken,
      Referer: 'http://localhost:8080/',
      'Content-Type': 'application/json',
    },
    data: { conversation_id: targetConvId },
  })
  expect(fanMsgResp.status()).toBe(201)

  // ── Step 4: Assert "без ответа" badge appears WITHOUT page.reload() ────────
  // The backend sends monitor.update over WS; the store merges it; Vue re-renders.
  // We target the specific row by fan_name + chatter display_name.
  const targetRow = page
    .locator('.queue-row')
    .filter({ has: page.locator('.queue-fan', { hasText: targetFanName }) })
    .filter({ has: page.locator('.queue-chatter', { hasText: targetChatterName }) })

  const unansweredBadge = targetRow.locator('.status-badge--unanswered')
  await expect(unansweredBadge).toBeVisible({ timeout: 8000 })
  await expect(unansweredBadge).toContainText('без ответа')

  // ── Step 5: Wait for client-side overdue flip (overdue_seconds = 10 s) ─────
  // The ticker in useTicker.ts updates every ~1 s; after 10 s the badge class
  // switches from status-badge--unanswered to status-badge--overdue with NO server event.
  const overdueBadge = targetRow.locator('.status-badge--overdue')
  await expect(overdueBadge).toBeVisible({ timeout: 15000 })
  await expect(overdueBadge).toContainText('просрочено')
})
