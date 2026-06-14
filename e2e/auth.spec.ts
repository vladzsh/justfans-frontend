import { test, expect } from '@playwright/test'

// Helper: login via the form and wait for redirect
async function login(page: import('@playwright/test').Page, username: string, password: string) {
  await page.goto('/login')
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
}

test.describe('auth', () => {
  test('teamlead login → lands on monitor with monitor-only element', async ({ page }) => {
    await login(page, 'teamlead1', 'demo1234')
    await expect(page).toHaveURL(/\/monitor/)
    // kpi-bar is a monitor-only element; verifies the page actually rendered
    await expect(page.locator('.kpi-bar')).toBeVisible()
    await expect(page.locator('.monitor-header-title')).toContainText('Монитор тимлида')
  })

  test('chatter1 login → lands on chat', async ({ page }) => {
    await login(page, 'chatter1', 'demo1234')
    await expect(page).toHaveURL('/chat')
    await expect(page.locator('.chat-layout')).toBeVisible()
    await expect(page.locator('.chat-header-title')).toContainText('JustFans CRM')
  })

  test('logout → redirected back to login page', async ({ page }) => {
    await login(page, 'chatter1', 'demo1234')
    await expect(page).toHaveURL('/chat')
    await page.click('.btn-logout')
    await expect(page).toHaveURL('/login')
    await expect(page.locator('#username')).toBeVisible()
  })

  test('invalid credentials → error shown, stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#username', 'no_such_user')
    await page.fill('#password', 'bad_password')
    await page.click('button[type="submit"]')
    // The login-error paragraph appears with the Russian error text
    await expect(page.locator('.login-error')).toBeVisible()
    await expect(page.locator('.login-error')).toContainText('Неверный логин или пароль')
    await expect(page).toHaveURL('/login')
  })
})
