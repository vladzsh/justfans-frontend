import { test, expect } from '@playwright/test'

test.describe('monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('#username', 'teamlead1')
    await page.fill('#password', 'demo1234')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/monitor/)
    // Wait for snapshot to load (KPI bar has numbers)
    await expect(page.locator('.kpi-bar')).toBeVisible()
  })

  test('KPI bar is visible and shows numeric values', async ({ page }) => {
    const kpiBar = page.locator('.kpi-bar')
    await expect(kpiBar).toBeVisible()

    // All four KPI labels must be present
    await expect(kpiBar.locator('.kpi-label', { hasText: 'Диалогов' })).toBeVisible()
    await expect(kpiBar.locator('.kpi-label', { hasText: 'Ждут' })).toBeVisible()
    await expect(kpiBar.locator('.kpi-label', { hasText: 'Просрочено' })).toBeVisible()
    await expect(kpiBar.locator('.kpi-label', { hasText: 'Онлайн' })).toBeVisible()

    // Each chip's .kpi-value must be non-empty and parseable as a number (or "N/N" for Онлайн)
    const values = kpiBar.locator('.kpi-value')
    const count = await values.count()
    expect(count).toBe(4)
    for (let i = 0; i < count; i++) {
      const text = await values.nth(i).textContent()
      expect(text?.trim()).toMatch(/\d/)
    }
  })

  test('Аналитика tab → /monitor/analytics shows charts canvas', async ({ page }) => {
    await page.click('a.monitor-tab:has-text("Аналитика")')
    await expect(page).toHaveURL(/\/monitor\/analytics/)
    await expect(page.locator('.charts-section')).toBeVisible()
    // vue-chartjs renders <canvas> elements for each chart
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('Чатеры tab → /monitor/chatters shows table with chatter rows', async ({ page }) => {
    await page.click('a.monitor-tab:has-text("Чатеры")')
    await expect(page).toHaveURL(/\/monitor\/chatters/)
    await expect(page.locator('.monitor-table')).toBeVisible()
    // seeded data has 4 chatters → tbody must have at least one row
    const rows = page.locator('.monitor-table tbody tr')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThanOrEqual(1)
  })

  test('Очередь tab → /monitor/queue shows queue rows with status badges', async ({ page }) => {
    await page.click('a.monitor-tab:has-text("Очередь")')
    await expect(page).toHaveURL(/\/monitor\/queue/)
    await expect(page.locator('.queue-wrap')).toBeVisible()
    // Queue must have rows
    await expect(page.locator('.queue-row').first()).toBeVisible()
  })

  test('Очередь shows ПРОСРОЧЕНО badge from seeded waiting dialog', async ({ page }) => {
    // Seeded data: Jake→chatter3 has awaiting_reply_since well in the past (> 10 s overdue threshold)
    // The client-side ticker computes overdue on page load → badge renders immediately
    await expect(page.locator('.status-badge--overdue').first()).toBeVisible()
    await expect(page.locator('.status-badge--overdue').first()).toContainText('просрочено')
  })
})
